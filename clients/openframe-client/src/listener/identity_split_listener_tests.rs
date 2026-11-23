use super::*;

fn message(session_id: &str) -> IdentitySplitMessage {
    IdentitySplitMessage {
        session_id: session_id.to_string(),
    }
}

#[test]
fn a_split_for_this_session_targets_it() {
    assert!(targets_this_session(&message("s-1"), "s-1"));
}

#[test]
fn a_split_for_another_device_does_not_target_this_session() {
    assert!(!targets_this_session(&message("s-2"), "s-1"));
}
