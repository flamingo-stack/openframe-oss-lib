use super::*;

const NOW: u64 = 1_800_000_000;
const MINUTE: u64 = 60;
const HOUR: u64 = 60 * MINUTE;
const DAY: u64 = 24 * HOUR;

fn saved(version: &str) -> SavedClientUpdate {
    SavedClientUpdate::new(
        OpenFrameClientUpdateMessage {
            version: version.to_string(),
            download_configurations: vec![],
        },
        NOW,
    )
}

#[test]
fn a_new_update_is_due_right_away() {
    let update = saved("1.5.107");

    assert!(update.is_due(NOW));
    assert_eq!(update.attempts, 0);
}

#[test]
fn attempts_wait_15_minutes_1_hour_4_hours_then_every_12_hours() {
    let mut update = saved("1.5.107");
    let mut now = NOW;
    let mut waits = Vec::new();

    for _ in 0..6 {
        update.start_attempt(now);
        waits.push(update.next_attempt_at - now);
        assert!(!update.is_due(now));
        now = update.next_attempt_at;
        assert!(update.is_due(now));
    }

    assert_eq!(
        waits,
        vec![15 * MINUTE, HOUR, 4 * HOUR, 12 * HOUR, 12 * HOUR, 12 * HOUR]
    );
    assert_eq!(update.attempts, 6);
}

#[test]
fn a_clock_that_went_back_makes_the_update_due() {
    let mut update = saved("1.5.107");
    update.start_attempt(NOW);

    assert!(!update.is_due(NOW + 14 * MINUTE));
    assert!(update.is_due(NOW - DAY));
}

#[test]
fn expires_seven_days_after_it_arrived() {
    let update = saved("1.5.107");

    assert!(!update.is_expired(NOW + 7 * DAY - 1));
    assert!(update.is_expired(NOW + 7 * DAY));
    assert!(!update.is_expired(NOW - DAY));
}

#[test]
fn targets_the_same_release_whatever_the_spelling() {
    let update = saved(" v1.5.107 ");

    assert!(update.targets("1.5.107"));
    assert!(update.targets("v1.5.107"));
    assert!(!update.targets("1.5.108"));
}

#[test]
fn an_unparsable_version_only_matches_itself() {
    let update = saved("nightly");

    assert!(update.targets("nightly"));
    assert!(!update.targets("1.5.107"));
}

#[test]
fn survives_a_round_trip_through_json() {
    let mut update = saved("1.5.107");
    update.start_attempt(NOW);

    let json = serde_json::to_string(&update).unwrap();
    let back: SavedClientUpdate = serde_json::from_str(&json).unwrap();

    assert_eq!(back.version(), "1.5.107");
    assert_eq!(back.attempts, 1);
    assert_eq!(back.next_attempt_at, NOW + 15 * MINUTE);
    assert_eq!(back.received_at, NOW);
}
