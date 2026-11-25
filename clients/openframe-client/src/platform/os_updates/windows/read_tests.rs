use super::*;
use crate::platform::os_updates::windows::fixtures::lock_wua_reader;

#[test]
#[ignore = "reads the live Windows state; run explicitly with --ignored"]
fn the_read_is_dated_after_its_last_reading() {
    let _reader = lock_wua_reader();
    let started = chrono::Utc::now();

    let inventory = read_inventory();

    let dated_after = (inventory.read_at - started).num_milliseconds();
    inventory.applicable.expect("search");
    inventory.last_scan.expect("last scan");
    inventory.history.expect("history");
    inventory.reboot.wua_reboot_required.expect("reboot");
    inventory.management.update_services.expect("services");
    assert!(inventory.read_duration_ms >= 500);
    assert!(dated_after >= inventory.read_duration_ms as i64 - 50);
}
