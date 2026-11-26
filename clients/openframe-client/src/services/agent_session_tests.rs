use super::*;

#[test]
fn the_session_id_stays_the_same_for_the_whole_process() {
    assert_eq!(session_id(), session_id());
}

#[test]
fn the_session_id_is_a_uuid() {
    assert!(Uuid::parse_str(session_id()).is_ok());
}
