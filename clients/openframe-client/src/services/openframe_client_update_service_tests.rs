use super::*;
use crate::clients::AuthClient;
use crate::platform::DmgExtractor;
use crate::services::encryption_service::EncryptionService;
use crate::services::installed_agent_message_publisher::InstalledAgentMessagePublisher;
use crate::services::local_tls_config_provider::LocalTlsConfigProvider;
use crate::services::nats_connection_manager::NatsConnectionManager;
use crate::services::nats_message_publisher::NatsMessagePublisher;
use crate::services::result_store::ResultStore;
use crate::services::shared_token_service::SharedTokenService;
use crate::services::update_cleanup_service::UpdateCleanupService;
use crate::services::{
    AgentAuthService, AgentConfigurationService, DeactivationService, InitialConfigurationService,
    InstalledToolsService, MachineIdService, ToolCommandParamsResolver, ToolKillService,
};
use crate::test_support::directories;
use crate::utils::in_progress::InProgress;
use tempfile::TempDir;

const RUNNING: &str = env!("OPENFRAME_VERSION");
const OTHER: &str = "9.9.9";

struct Fixture {
    _dir: TempDir,
    service: OpenFrameClientUpdateService,
    tool_ops: ToolOps,
    tool_run_manager: ToolRunManager,
    #[cfg(unix)]
    package_upgrades: InProgress,
}

fn fixture() -> Fixture {
    let dir = tempfile::tempdir().unwrap();
    let directories = directories(&dir);
    let config = AgentConfigurationService::new(directories.clone()).unwrap();
    let initial = InitialConfigurationService::new(directories.clone()).unwrap();
    let tool_ops = ToolOps::default();
    let tool_run_manager = ToolRunManager::new(
        InstalledToolsService::new(directories.clone()).unwrap(),
        ToolCommandParamsResolver::new(directories.clone(), initial.clone(), config.clone()),
        ToolKillService::new(),
        tool_ops.clone(),
    );
    let deactivation = DeactivationService::new(&directories);
    let auth = AgentAuthService::new(
        AuthClient::new(
            "http://127.0.0.1:9".into(),
            reqwest::Client::new(),
            deactivation.clone(),
        ),
        config.clone(),
        SharedTokenService::new(directories.clone(), EncryptionService::new()),
    );
    let nats = NatsConnectionManager::new(
        "nats://127.0.0.1:9".into(),
        config.clone(),
        initial.clone(),
        auth,
        LocalTlsConfigProvider::new(initial),
        deactivation,
        MachineIdService::new(&directories),
    );
    let update_state = UpdateStateService::new(directories.clone()).unwrap();
    let client_info = OpenFrameClientInfoService::new(directories.clone()).unwrap();
    let last_known_good = LastKnownGoodService::new(directories.clone()).unwrap();
    let update_handler = UpdateHandlerService::new(
        update_state.clone(),
        client_info.clone(),
        UpdateCleanupService::for_binary(dir.path().join("openframe-client")),
        last_known_good.clone(),
        InstalledAgentMessagePublisher::new(NatsMessagePublisher::new(nats)),
        config,
        Arc::new(ResultStore::open_or_degrade(
            directories.secured_dir().join("scheduled_outbox.redb"),
        )),
    );
    let package_upgrades = InProgress::default();
    let service = OpenFrameClientUpdateService::new(
        client_info,
        GithubDownloadService::new(reqwest::Client::new(), DmgExtractor::new()),
        update_state,
        last_known_good,
        tool_run_manager.clone(),
        tool_ops.clone(),
        package_upgrades.view(),
        update_handler,
    );
    Fixture {
        _dir: dir,
        service,
        tool_ops,
        tool_run_manager,
        #[cfg(unix)]
        package_upgrades,
    }
}

fn update(version: &str) -> OpenFrameClientUpdateMessage {
    OpenFrameClientUpdateMessage {
        version: version.to_string(),
        download_configurations: Vec::new(),
    }
}

#[tokio::test]
async fn only_an_update_to_another_version_waits_for_busy_tools_and_parks_them() {
    let f = fixture();
    let busy = f.tool_ops.lock("mesh").await.mark_busy();

    drop(f.service.reserve(&update(RUNNING)).unwrap());
    assert!(!f.tool_run_manager.is_client_update_pending());

    let err = f.service.reserve(&update(OTHER)).err().unwrap();
    assert!(format!("{err:#}").contains("Tool operation in progress"));
    assert!(f.tool_run_manager.is_client_update_pending());

    drop(busy);
    let other_update = f.service.reserve(&update(OTHER)).unwrap();
    let err = f.service.reserve(&update(RUNNING)).err().unwrap();
    assert!(format!("{err:#}").contains("Update already in progress"));

    drop(other_update);
    let guard = f.service.reserve(&update(RUNNING)).unwrap();
    let launch = f.service.apply(update(RUNNING), guard).await.unwrap();
    assert_eq!(launch, UpdateLaunch::Skipped);
    assert!(
        !f.tool_run_manager.is_client_update_pending(),
        "a skip releases parked tools, like the downgrade skip; a live deferred update parks them again"
    );
}

#[cfg(unix)]
mod staged_version_check {
    use super::*;
    use crate::models::DownloadConfiguration;
    use crate::test_support::mock_server_with_body;
    use std::io::Write;

    /// A tar.gz holding a script that answers `--version` with `reported`, padded and stored uncompressed past the minimum download size.
    fn release_archive(target_file_name: &str, reported: &str) -> Vec<u8> {
        let mut script = format!("#!/bin/sh\necho \"openframe-client {reported}\"\nexit 0\n");
        while script.len() < 200 * 1024 {
            script.push_str("# padding to pass the minimum binary size check\n");
        }
        let mut header = tar::Header::new_gnu();
        header.set_size(script.len() as u64);
        header.set_mode(0o644);
        header.set_cksum();
        let mut archive = tar::Builder::new(Vec::new());
        archive
            .append_data(&mut header, target_file_name, script.as_bytes())
            .unwrap();
        let mut gz = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::none());
        gz.write_all(&archive.into_inner().unwrap()).unwrap();
        gz.finish().unwrap()
    }

    #[tokio::test]
    async fn only_a_clear_mismatch_refuses_the_staged_binary() {
        let dir = tempfile::tempdir().unwrap();
        let expected = Version::parse("1.5.107").unwrap();
        let verdict = |reported: &str| {
            let path = dir.path().join(format!("staged-{reported}"));
            std::fs::write(&path, format!("#!/bin/sh\necho \"{reported}\"\n")).unwrap();
            let expected = expected.clone();
            async move { OpenFrameClientUpdateService::verify_staged_version(&path, &expected).await }
        };

        for reported in ["openframe-client 1.5.103", "openframe-client 1.5.107-rc.1"] {
            let reason = format!("{:#}", verdict(reported).await.expect_err(reported));
            assert!(reason.contains("expected 1.5.107"), "{reason}");
        }
        for reported in ["openframe-client v1.5.107+build.9", "openframe-client dev"] {
            verdict(reported)
                .await
                .unwrap_or_else(|e| panic!("{reported}: {e:#}"));
        }
    }

    fn staged_copies(target_file_name: &str) -> Vec<PathBuf> {
        std::fs::read_dir(get_update_staging_directory())
            .unwrap()
            .filter_map(|e| e.ok().map(|e| e.path()))
            .filter(|p| p.to_string_lossy().ends_with(target_file_name))
            .collect()
    }

    #[tokio::test]
    async fn a_downloaded_build_of_another_version_is_refused_before_the_updater_runs() {
        let f = fixture();
        let target_file_name = format!("openframe-client-{}", Uuid::new_v4());
        let server =
            mock_server_with_body(&[200], release_archive(&target_file_name, "1.5.103")).await;
        let link = format!("{}/openframe-client.tar.gz", server.url);
        let message = OpenFrameClientUpdateMessage {
            version: "1.5.107".to_string(),
            download_configurations: vec![DownloadConfiguration {
                os: std::env::consts::OS.to_string(),
                file_name: "openframe-client.tar.gz".to_string(),
                target_file_name: target_file_name.clone(),
                link,
                installation_type: Default::default(),
                bundle_id: None,
                service_name: None,
            }],
        };

        let guard = f.service.reserve(&message).unwrap();
        // should the check let the build through, the late busy check still stops it before an updater launches
        let _upgrade = f.package_upgrades.begin();
        let err = f.service.apply(message, guard).await.err().unwrap();

        let reason = format!("{err:#}");
        assert!(reason.contains("reports version 1.5.103"), "{reason}");
        assert!(reason.contains("expected 1.5.107"), "{reason}");
        assert!(staged_copies(&target_file_name).is_empty());
        assert!(matches!(
            f.service.update_state_service.read_state().await.unwrap(),
            JsonFile::Missing
        ));
        assert_eq!(
            f.service.client_info_service.get().await.unwrap().status,
            ClientUpdateStatus::Failed
        );
    }
}
