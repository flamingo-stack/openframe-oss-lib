use super::*;
use crate::clients::AuthClient;
use crate::models::update_state::UpdatePhase;
use crate::models::SavedClientUpdate;
use crate::platform::{DirectoryManager, DmgExtractor};
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
use tempfile::TempDir;

const RUNNING: &str = env!("OPENFRAME_VERSION");
const NEWER: &str = "999.0.0";
const MINUTE: u64 = 60;
const DAY: u64 = 24 * 60 * MINUTE;

struct Fixture {
    _dir: TempDir,
    directories: DirectoryManager,
    service: OpenFrameClientUpdateService,
    handler: UpdateHandlerService,
    update_state: UpdateStateService,
    tool_ops: ToolOps,
    tool_run_manager: ToolRunManager,
}

impl Fixture {
    fn new() -> Self {
        let dir = TempDir::new().unwrap();
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
        let handler = UpdateHandlerService::new(
            update_state.clone(),
            client_info.clone(),
            UpdateCleanupService::for_binary(dir.path().join("openframe-client")),
            last_known_good.clone(),
            InstalledAgentMessagePublisher::new(NatsMessagePublisher::new(nats)),
            config,
            Arc::new(ResultStore::open_or_degrade(
                directories.secured_dir().join("outbox.redb"),
            )),
        );
        let service = OpenFrameClientUpdateService::new(
            client_info,
            GithubDownloadService::new(reqwest::Client::new(), DmgExtractor::new()),
            update_state.clone(),
            last_known_good,
            tool_run_manager.clone(),
            tool_ops.clone(),
            handler.clone(),
        );
        Self {
            _dir: dir,
            directories,
            service,
            handler,
            update_state,
            tool_ops,
            tool_run_manager,
        }
    }

    async fn saved(&self) -> Option<SavedClientUpdate> {
        self.update_state.load_saved_update().await
    }

    fn write_saved(&self, saved: &SavedClientUpdate) {
        std::fs::write(
            self.directories
                .secured_dir()
                .join("saved_client_update.json"),
            serde_json::to_vec(saved).unwrap(),
        )
        .unwrap();
    }
}

fn message(version: &str) -> OpenFrameClientUpdateMessage {
    OpenFrameClientUpdateMessage {
        version: version.to_string(),
        download_configurations: vec![],
    }
}

fn failed_state(version: &str) -> UpdateState {
    let mut state = UpdateState::new(version.to_string());
    state.set_phase(UpdatePhase::RolledBack);
    state
}

#[tokio::test]
async fn reserve_passes_a_message_for_the_running_version_without_parking_tools() {
    let fixture = Fixture::new();
    let _busy = fixture.tool_ops.lock("fleetmdm-server").await.mark_busy();

    assert!(fixture.service.reserve(&message(RUNNING)).is_ok());
    assert!(!fixture.tool_run_manager.is_client_update_pending());
}

#[tokio::test]
async fn reserve_defers_an_update_behind_a_busy_tool_and_parks_new_tool_operations() {
    let fixture = Fixture::new();
    let _busy = fixture.tool_ops.lock("fleetmdm-server").await.mark_busy();

    assert!(fixture.service.reserve(&message(NEWER)).is_err());
    assert!(fixture.tool_run_manager.is_client_update_pending());
}

#[tokio::test]
async fn the_newest_message_replaces_the_saved_update() {
    let fixture = Fixture::new();

    fixture
        .service
        .save_for_retry(message(NEWER))
        .await
        .unwrap();
    fixture
        .update_state
        .start_saved_attempt(NEWER)
        .await
        .unwrap();
    fixture
        .service
        .save_for_retry(message("998.0.0"))
        .await
        .unwrap();

    let saved = fixture.saved().await.unwrap();
    assert_eq!(saved.version(), "998.0.0");
    assert_eq!(saved.attempts, 0);
    assert!(saved.is_due(now_secs()));
}

#[tokio::test]
async fn a_message_for_the_running_version_drops_the_saved_update() {
    let fixture = Fixture::new();
    fixture
        .service
        .save_for_retry(message(NEWER))
        .await
        .unwrap();

    fixture
        .service
        .save_for_retry(message(RUNNING))
        .await
        .unwrap();

    assert!(fixture.saved().await.is_none());
}

#[tokio::test]
async fn a_message_with_an_invalid_version_is_not_saved() {
    let fixture = Fixture::new();
    fixture
        .service
        .save_for_retry(message(NEWER))
        .await
        .unwrap();

    fixture
        .service
        .save_for_retry(message("latest"))
        .await
        .unwrap();

    assert_eq!(fixture.saved().await.unwrap().version(), NEWER);
}

#[tokio::test]
async fn nothing_runs_without_a_due_saved_update() {
    let fixture = Fixture::new();
    assert_eq!(
        fixture.service.run_saved_update(true).await,
        SavedUpdateRun::Idle
    );

    fixture
        .service
        .save_for_retry(message(NEWER))
        .await
        .unwrap();
    fixture
        .update_state
        .start_saved_attempt(NEWER)
        .await
        .unwrap();

    assert_eq!(
        fixture.service.run_saved_update(true).await,
        SavedUpdateRun::Idle
    );
    assert_eq!(fixture.saved().await.unwrap().attempts, 1);
}

#[tokio::test]
async fn while_holding_tools_a_busy_tool_defers_the_update_and_parks_new_tool_operations() {
    let fixture = Fixture::new();
    let _busy = fixture.tool_ops.lock("fleetmdm-server").await.mark_busy();
    fixture
        .service
        .save_for_retry(message(NEWER))
        .await
        .unwrap();

    assert_eq!(
        fixture.service.run_saved_update(true).await,
        SavedUpdateRun::Deferred
    );
    assert!(fixture.tool_run_manager.is_client_update_pending());
    assert_eq!(fixture.saved().await.unwrap().attempts, 0);
}

#[tokio::test]
async fn past_the_hold_a_busy_tool_defers_the_update_without_parking_new_tool_operations() {
    let fixture = Fixture::new();
    let _busy = fixture.tool_ops.lock("fleetmdm-server").await.mark_busy();
    fixture
        .service
        .save_for_retry(message(NEWER))
        .await
        .unwrap();

    assert_eq!(
        fixture.service.run_saved_update(false).await,
        SavedUpdateRun::Deferred
    );
    assert!(!fixture.tool_run_manager.is_client_update_pending());
    assert_eq!(fixture.saved().await.unwrap().attempts, 0);
}

#[tokio::test]
async fn a_failed_attempt_keeps_the_update_for_the_next_one_in_15_minutes() {
    let fixture = Fixture::new();
    fixture
        .service
        .save_for_retry(message(NEWER))
        .await
        .unwrap();
    let before = now_secs();

    assert_eq!(
        fixture.service.run_saved_update(true).await,
        SavedUpdateRun::Attempted
    );

    let saved = fixture.saved().await.unwrap();
    assert_eq!(saved.attempts, 1);
    assert!(saved.next_attempt_at >= before + 15 * MINUTE);
    assert!(!saved.is_due(now_secs()));
    assert!(!fixture.tool_run_manager.is_client_update_pending());
}

#[tokio::test]
async fn a_failed_attempt_seven_days_after_the_message_drops_the_update() {
    let fixture = Fixture::new();
    fixture.write_saved(&SavedClientUpdate::new(
        message(NEWER),
        now_secs() - 7 * DAY,
    ));

    assert_eq!(
        fixture.service.run_saved_update(true).await,
        SavedUpdateRun::Attempted
    );

    assert!(fixture.saved().await.is_none());
}

#[tokio::test]
async fn a_saved_update_that_no_longer_applies_is_dropped() {
    let fixture = Fixture::new();
    fixture
        .update_state
        .save_update(message(RUNNING))
        .await
        .unwrap();

    assert_eq!(
        fixture.service.run_saved_update(true).await,
        SavedUpdateRun::Attempted
    );

    assert!(fixture.saved().await.is_none());
}

#[tokio::test]
async fn a_delivery_engine_update_drops_the_saved_one() {
    let fixture = Fixture::new();
    fixture
        .service
        .save_for_retry(message(NEWER))
        .await
        .unwrap();

    fixture.service.drop_saved_update().await;

    assert!(fixture.saved().await.is_none());
}

#[tokio::test]
async fn a_failed_update_keeps_its_saved_copy_until_seven_days_have_passed() {
    let fixture = Fixture::new();
    fixture
        .service
        .save_for_retry(message(NEWER))
        .await
        .unwrap();

    fixture
        .handler
        .handle_failure(failed_state(NEWER))
        .await
        .unwrap();
    assert!(fixture.saved().await.is_some());

    fixture.write_saved(&SavedClientUpdate::new(
        message(NEWER),
        now_secs() - 7 * DAY,
    ));
    fixture
        .handler
        .handle_failure(failed_state(NEWER))
        .await
        .unwrap();
    assert!(fixture.saved().await.is_none());
}

#[tokio::test]
async fn a_failed_update_leaves_a_newer_saved_update_alone() {
    let fixture = Fixture::new();
    fixture.write_saved(&SavedClientUpdate::new(
        message(NEWER),
        now_secs() - 7 * DAY,
    ));

    fixture
        .handler
        .handle_failure(failed_state("998.0.0"))
        .await
        .unwrap();

    assert_eq!(fixture.saved().await.unwrap().version(), NEWER);
}

#[tokio::test]
async fn a_successful_update_drops_its_saved_copy() {
    let fixture = Fixture::new();
    fixture
        .update_state
        .save_update(message(RUNNING))
        .await
        .unwrap();
    fixture
        .update_state
        .save(&UpdateState::new(RUNNING.to_string()))
        .await
        .unwrap();

    fixture.handler.handle_pending_update().await.unwrap();

    assert!(fixture.saved().await.is_none());
}

#[tokio::test]
async fn a_successful_update_keeps_a_newer_saved_update() {
    let fixture = Fixture::new();
    fixture
        .service
        .save_for_retry(message(NEWER))
        .await
        .unwrap();
    fixture
        .update_state
        .save(&UpdateState::new(RUNNING.to_string()))
        .await
        .unwrap();

    fixture.handler.handle_pending_update().await.unwrap();

    assert_eq!(fixture.saved().await.unwrap().version(), NEWER);
}

#[test]
fn reads_the_version_from_the_version_line() {
    assert_eq!(
        OpenFrameClientUpdateService::parse_reported_version("openframe-client 1.5.107\n"),
        Some("1.5.107".to_string())
    );
    assert_eq!(
        OpenFrameClientUpdateService::parse_reported_version("openframe-client v1.5.107"),
        Some("1.5.107".to_string())
    );
    assert_eq!(
        OpenFrameClientUpdateService::parse_reported_version("openframe-client dev"),
        None
    );
    assert_eq!(
        OpenFrameClientUpdateService::parse_reported_version(""),
        None
    );
}

#[cfg(unix)]
fn script(dir: &TempDir, name: &str, body: &str) -> PathBuf {
    let path = dir.path().join(name);
    std::fs::write(&path, format!("#!/bin/sh\n{body}\n")).unwrap();
    path
}

#[cfg(unix)]
#[tokio::test]
async fn asks_the_staged_binary_for_its_version() {
    let dir = TempDir::new().unwrap();
    let staged = script(&dir, "staged", "echo 'openframe-client 1.5.107'");

    assert_eq!(
        OpenFrameClientUpdateService::staged_binary_version(&staged).await,
        Some("1.5.107".to_string())
    );
}

#[cfg(unix)]
#[tokio::test]
async fn a_staged_binary_that_cannot_tell_its_version_reports_none() {
    let dir = TempDir::new().unwrap();
    let failing = script(&dir, "failing", "exit 1");
    let missing = dir.path().join("missing");

    assert_eq!(
        OpenFrameClientUpdateService::staged_binary_version(&failing).await,
        None
    );
    assert_eq!(
        OpenFrameClientUpdateService::staged_binary_version(&missing).await,
        None
    );
}
