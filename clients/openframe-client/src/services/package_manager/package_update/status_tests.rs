use super::*;
use crate::models::{DoneResult, PackageRef, SourceKind, UpdateMode, UpdateSource};

fn order() -> Order {
    Order {
        request_id: "req-1".to_string(),
        sequence: 1,
        source: UpdateSource {
            kind: SourceKind::Auto,
            origin: None,
        },
        package: PackageRef::Winget {
            id: "Vendor.App".to_string(),
        },
        mode: UpdateMode::Wait,
        countdown_seconds: 0,
        received_at: 0,
        revision: 0,
    }
}

#[test]
fn a_built_event_carries_the_order_and_a_fresh_id() {
    let done = Report::Done(Done {
        result: DoneResult::Upgraded,
        reboot_required: true,
        relaunched: false,
    });

    let order = order();
    let event = build(
        "m-1",
        &order.request_id,
        &order.source,
        &order.package,
        Some("1.0"),
        Some("2.0"),
        done,
    );

    assert_eq!(event.request_id, "req-1");
    assert_eq!(event.machine_id, "m-1");
    assert_eq!(event.state, UpdateStatus::Done);
    assert_eq!(event.installed_version.as_deref(), Some("1.0"));
    assert_eq!(event.available_version.as_deref(), Some("2.0"));
    assert!(event.done.as_ref().is_some_and(|d| d.reboot_required));
    assert!(event.waiting.is_none() && event.failed.is_none());
    assert!(uuid::Uuid::parse_str(&event.event_id).is_ok());
    assert!(
        event.at.ends_with('Z') && event.at.contains('.'),
        "{}",
        event.at
    );
}

#[test]
fn unix_seconds_render_as_utc_rfc3339() {
    assert_eq!(rfc3339(1_792_000_000), "2026-10-14T17:46:40Z");
}

#[tokio::test]
async fn a_superseded_report_is_a_failed_event_with_the_reason() {
    let (reporter, events) = StatusReporter::in_memory();

    reporter.report_superseded("m-1", &order()).await;

    let events = events.lock().unwrap();
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].state, UpdateStatus::Failed);
    assert_eq!(
        events[0].failed.as_ref().map(|f| f.reason),
        Some(FailReason::Superseded)
    );
}

#[test]
fn outbox_keys_sort_in_the_order_events_happened() {
    let keys = [
        outbox_key(999_999_999, "ffffffff-0000-4000-8000-000000000000"),
        outbox_key(1_000_000_000, "00000000-0000-4000-8000-000000000000"),
        outbox_key(
            1_761_600_000_000_000_001,
            "88888888-0000-4000-8000-000000000000",
        ),
    ];

    let mut sorted = keys.clone();
    sorted.sort();
    assert_eq!(sorted, keys);
}
