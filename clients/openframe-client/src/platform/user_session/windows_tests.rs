use super::*;

#[test]
fn the_console_logon_id_is_stable_within_a_logon() {
    assert_eq!(console_logon_id(), console_logon_id());
}
