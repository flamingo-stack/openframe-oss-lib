use super::*;
use crate::test_support::client_update_fixture;
use serde_json::json;
use tempfile::TempDir;

fn message(version: &str) -> OpenFrameClientUpdateMessage {
    serde_json::from_value(json!({ "version": version, "downloadConfigurations": [] })).unwrap()
}

#[test]
fn reads_the_version_clap_prints() {
    let version = |stdout| parse_version_output(stdout).map(|v| v.to_string());
    assert_eq!(
        version("openframe-client 1.5.107\n"),
        Some("1.5.107".into())
    );
    assert_eq!(
        version("openframe-client v1.5.107-rc.1\r\n"),
        Some("1.5.107-rc.1".into())
    );
    assert_eq!(version("openframe-client dev\n"), None);
    assert_eq!(version(""), None);
}

#[test]
fn canonical_version_is_what_apply_compares_with_the_running_one() {
    assert_eq!(canonical_version(" v1.5.7 "), Some("1.5.7".into()));
    assert_eq!(
        canonical_version("1.5.7+build.3"),
        Some("1.5.7+build.3".into())
    );
    assert_eq!(canonical_version("dev"), None);
    assert_eq!(canonical_version("latest"), None);
    assert_eq!(canonical_version("1.5"), None);
}

#[tokio::test]
async fn the_running_version_neither_waits_for_busy_tools_nor_parks_them() {
    let dir = TempDir::new().unwrap();
    let fixture = client_update_fixture(&dir);
    let _busy = fixture.tool_ops.lock("mesh").await.mark_busy();

    let guard = fixture
        .service
        .reserve(&message(env!("OPENFRAME_VERSION")))
        .unwrap();
    assert!(!fixture.tool_run_manager.is_client_update_pending());
    drop(guard);

    assert!(fixture.service.reserve(&message("9.9.9")).is_err());
    assert!(fixture.tool_run_manager.is_client_update_pending());
}

#[tokio::test]
async fn a_second_update_is_refused_while_one_holds_the_slot() {
    let dir = TempDir::new().unwrap();
    let fixture = client_update_fixture(&dir);
    let _running = fixture.service.reserve(&message("9.9.8")).unwrap();

    assert!(fixture.service.reserve(&message("9.9.9")).is_err());
    assert!(!fixture.service.tools_busy());
}

#[cfg(unix)]
fn staged_script(dir: &TempDir, body: &str) -> PathBuf {
    let path = dir.path().join("openframe-update-staged");
    std::fs::write(&path, format!("#!/bin/sh\n{body}\n")).unwrap();
    path
}

#[cfg(unix)]
#[tokio::test]
async fn a_staged_binary_reporting_another_version_is_refused() {
    use std::os::unix::fs::PermissionsExt;
    let dir = TempDir::new().unwrap();
    let staged = staged_script(&dir, "echo 'openframe-client 1.5.103'");

    let refused = OpenFrameClientUpdateService::verify_staged_version(&staged, "1.5.107").await;

    assert!(
        refused.unwrap_err().to_string().contains("1.5.103"),
        "the error names the version found"
    );
    assert_ne!(
        std::fs::metadata(&staged).unwrap().permissions().mode() & 0o111,
        0
    );
    OpenFrameClientUpdateService::verify_staged_version(&staged, "1.5.103")
        .await
        .unwrap();
}

#[cfg(unix)]
#[tokio::test]
async fn a_probe_that_cannot_tell_the_version_lets_the_update_go_ahead() {
    let dir = TempDir::new().unwrap();
    for body in [
        "echo 'openframe-client dev'",
        "echo 'openframe-client 1.5.103'; exit 3",
        "echo nothing",
    ] {
        let staged = staged_script(&dir, body);
        OpenFrameClientUpdateService::verify_staged_version(&staged, "1.5.107")
            .await
            .unwrap_or_else(|e| panic!("{body}: {e:#}"));
    }
    OpenFrameClientUpdateService::verify_staged_version(&dir.path().join("missing"), "1.5.107")
        .await
        .unwrap();
}

#[cfg(unix)]
#[tokio::test(start_paused = true)]
async fn a_probe_that_hangs_lets_the_update_go_ahead() {
    let dir = TempDir::new().unwrap();
    let staged = staged_script(&dir, "exec sleep 60");
    let started = tokio::time::Instant::now();

    OpenFrameClientUpdateService::verify_staged_version(&staged, "1.5.107")
        .await
        .unwrap();

    assert!(
        started.elapsed() >= Duration::from_secs(STAGED_VERSION_PROBE_TIMEOUT_SECS),
        "the probe gave up before its timeout, so another path let the update go ahead"
    );
}
