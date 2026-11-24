use super::*;

#[test]
fn outbox_keys_sort_in_the_order_events_happened() {
    let keys = [
        outbox_key(
            "package-update-status",
            999_999_999,
            "ffffffff-0000-4000-8000-000000000000",
        ),
        outbox_key(
            "package-update-status",
            1_000_000_000,
            "00000000-0000-4000-8000-000000000000",
        ),
        outbox_key(
            "package-update-status",
            1_761_600_000_000_000_001,
            "88888888-0000-4000-8000-000000000000",
        ),
    ];

    let mut sorted = keys.clone();
    sorted.sort();
    assert_eq!(sorted, keys);
}

#[test]
fn an_update_status_keeps_the_key_older_agents_wrote() {
    assert_eq!(
        outbox_key("package-update-status", 42, "e-1"),
        "package-update-status:00000000000000000042:e-1"
    );
}
