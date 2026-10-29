use super::*;
use crate::test_support::{client_update_fixture, ClientUpdateFixture};
use serde_json::json;
use tempfile::TempDir;

const LINK: &str = "https://tenant.example/v0/api/assets/download?agent=client&platform=plan9";

/// Its only download configuration is for another OS, so an attempt fails before any download.
fn message(version: &str) -> OpenFrameClientUpdateMessage {
    serde_json::from_value(json!({
        "version": version,
        "downloadConfigurations": [{
            "os": "plan9",
            "fileName": "openframe-client.zip",
            "targetFileName": "openframe-client",
            "link": LINK,
        }],
    }))
    .unwrap()
}

fn retry_service(fixture: &ClientUpdateFixture) -> ClientUpdateRetryService {
    ClientUpdateRetryService::new(
        &fixture.directories,
        fixture.service.clone(),
        fixture.tool_run_manager.clone(),
        fixture.nats.clone(),
    )
}

fn setup() -> (TempDir, ClientUpdateFixture, ClientUpdateRetryService) {
    let dir = TempDir::new().unwrap();
    let fixture = client_update_fixture(&dir);
    let retry = retry_service(&fixture);
    (dir, fixture, retry)
}

fn saved(retry: &ClientUpdateRetryService) -> PendingClientUpdate {
    retry.load().expect("an update is saved")
}

fn attempted(at: DateTime<Utc>, attempts: u32, received_at: DateTime<Utc>) -> PendingClientUpdate {
    PendingClientUpdate {
        message: message("9.9.9"),
        received_at,
        attempts,
        last_attempt_at: Some(at),
    }
}

#[test]
fn retries_wait_15_minutes_1_hour_4_hours_then_every_12_hours() {
    let hours = |attempts| retry_delay(attempts).num_minutes() as f64 / 60.0;
    assert_eq!(hours(1), 0.25);
    assert_eq!(hours(2), 1.0);
    assert_eq!(hours(3), 4.0);
    assert_eq!(hours(4), 12.0);
    assert_eq!(hours(30), 12.0);
}

#[test]
fn a_new_message_is_due_at_once_and_a_failed_attempt_waits_its_delay() {
    let now = Utc::now();
    assert!(PendingClientUpdate::new(message("9.9.9"), now).is_due(now));

    let pending = attempted(now, 2, now);
    assert!(!pending.is_due(now + TimeDelta::minutes(59)));
    assert!(pending.is_due(now + TimeDelta::hours(1)));
}

#[test]
fn a_clock_that_went_back_does_not_hold_the_retry_off_or_end_it() {
    let now = Utc::now();
    let pending = attempted(now + TimeDelta::days(30), 4, now - TimeDelta::days(1));

    assert!(pending.is_due(now));
    assert!(!pending.has_expired(now));
}

#[test]
fn retries_end_only_after_an_attempt_a_week_after_arrival_failed() {
    let received = Utc::now() - TimeDelta::days(20);
    let week = TimeDelta::days(7);

    // off from day 6 to day 20: the attempt from day 6 does not end it, so one more runs now
    let before_deadline = attempted(received + TimeDelta::days(6), 9, received);
    assert!(!before_deadline.has_expired(Utc::now()));
    assert!(before_deadline.is_due(Utc::now()));

    let past_deadline = attempted(received + week, 10, received);
    assert!(past_deadline.has_expired(Utc::now()));
}

#[tokio::test]
async fn remember_saves_the_message_as_sent_and_a_new_one_starts_over() {
    let (_dir, _fixture, retry) = setup();

    assert!(retry.remember(&message("9.9.8")));
    retry.run_due().await;
    assert_eq!(saved(&retry).attempts, 1);

    assert!(retry.remember(&message("9.9.9")));
    let pending = saved(&retry);
    assert_eq!(pending.message.version, "9.9.9");
    assert_eq!(pending.message.download_configurations[0].link, LINK);
    assert_eq!(pending.attempts, 0);
    assert!(pending.is_due(Utc::now()));
}

#[tokio::test]
async fn a_failed_attempt_is_retried_only_after_its_delay_and_releases_parked_tools() {
    let (_dir, fixture, retry) = setup();

    assert!(retry.remember(&message("9.9.9")));
    retry.run_due().await;
    let pending = saved(&retry);
    assert_eq!(pending.attempts, 1);
    assert!(!fixture.tool_run_manager.is_client_update_pending());

    retry.run_due().await;
    assert_eq!(saved(&retry).attempts, 1);
}

#[tokio::test]
async fn the_attempt_is_on_disk_before_the_update_runs() {
    let (_dir, _fixture, retry) = setup();
    assert!(retry.remember(&message("9.9.9")));

    let (_message, _guard) = retry.begin_due_attempt().expect("a fresh message is due");

    let pending = saved(&retry);
    assert_eq!(pending.attempts, 1);
    assert!(pending.last_attempt_at.is_some());
}

#[tokio::test]
async fn a_message_for_the_running_version_drops_the_saved_one() {
    let (_dir, _fixture, retry) = setup();
    assert!(retry.remember(&message("9.9.9")));

    assert!(!retry.remember(&message(env!("OPENFRAME_VERSION"))));

    assert!(retry.load().is_none());
}

#[tokio::test]
async fn an_installed_update_is_dropped_but_a_newer_saved_one_survives() {
    let (_dir, _fixture, retry) = setup();
    let mut installed = attempted(Utc::now(), 1, Utc::now());
    installed.message = message(env!("OPENFRAME_VERSION"));
    retry.save(&installed).unwrap();

    retry.run_due().await;
    assert!(retry.load().is_none());

    retry.save(&attempted(Utc::now(), 1, Utc::now())).unwrap();
    retry.run_due().await;
    assert_eq!(saved(&retry).message.version, "9.9.9");
}

#[tokio::test]
async fn an_invalid_version_is_not_saved() {
    let (_dir, _fixture, retry) = setup();

    assert!(!retry.remember(&message("dev")));
    assert!(!retry.remember(&message("latest")));

    assert!(retry.load().is_none());
}

#[tokio::test]
async fn a_refused_downgrade_is_dropped() {
    let (_dir, fixture, retry) = setup();
    std::fs::write(
        fixture
            .directories
            .secured_dir()
            .join("last_known_good.json"),
        r#"{"version":"99.0.0"}"#,
    )
    .unwrap();
    assert!(retry.remember(&message("9.9.9")));

    retry.run_due().await;

    assert!(retry.load().is_none());
}

#[tokio::test]
async fn a_corrupt_saved_file_is_moved_aside() {
    let (_dir, fixture, retry) = setup();
    std::fs::write(&retry.pending_file_path, [0u8; 64]).unwrap();

    retry.run_due().await;

    assert!(!retry.pending_file_path.exists());
    assert!(fixture
        .directories
        .secured_dir()
        .join("pending_client_update.json.corrupt")
        .exists());
}

#[tokio::test]
async fn an_update_in_progress_does_not_use_up_an_attempt() {
    let (_dir, fixture, retry) = setup();
    let _running = fixture.service.reserve(&message("9.9.8")).unwrap();
    assert!(retry.remember(&message("9.9.9")));

    retry.run_due().await;

    assert_eq!(saved(&retry).attempts, 0);
}

#[tokio::test]
async fn no_attempt_starts_soon_after_this_process_launched_the_updater() {
    let (_dir, _fixture, retry) = setup();
    retry.lock().launched_at = Some(Instant::now());
    assert!(retry.remember(&message("9.9.9")));

    retry.run_due().await;

    assert_eq!(saved(&retry).attempts, 0);
}

#[tokio::test(start_paused = true)]
async fn busy_tools_are_parked_for_20_minutes_then_waited_for_without_parking() {
    let (_dir, fixture, retry) = setup();
    let busy = fixture.tool_ops.lock("mesh").await.mark_busy();
    assert!(retry.remember(&message("9.9.9")));

    retry.run_due().await;
    assert_eq!(saved(&retry).attempts, 0);
    assert!(fixture.tool_run_manager.is_client_update_pending());

    tokio::time::advance(Duration::from_secs(CLIENT_UPDATE_BUSY_PARK_SECS)).await;
    retry.run_due().await;
    assert_eq!(saved(&retry).attempts, 0);
    assert!(!fixture.tool_run_manager.is_client_update_pending());

    retry.run_due().await;
    assert!(
        !fixture.tool_run_manager.is_client_update_pending(),
        "past the hold a check while the tool is busy must not park tool operations again"
    );

    drop(busy);
    retry.run_due().await;
    assert_eq!(saved(&retry).attempts, 1);
}

#[tokio::test]
async fn discard_drops_the_saved_update() {
    let (_dir, _fixture, retry) = setup();
    assert!(retry.remember(&message("9.9.9")));

    retry.discard("test");

    assert!(retry.load().is_none());
}
