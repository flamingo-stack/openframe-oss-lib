use super::*;

#[test]
#[ignore = "reads the live Windows state; run explicitly with --ignored"]
fn the_read_is_dated_after_its_last_reading() {
    let started = chrono::Utc::now();

    let inventory = read_inventory();

    let dated_after = (inventory.read_at - started).num_milliseconds();
    assert!(inventory.read_duration_ms >= 500);
    assert!(dated_after >= inventory.read_duration_ms as i64 - 50);
}
