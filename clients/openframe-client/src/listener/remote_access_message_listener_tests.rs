use super::*;

#[test]
fn subject_covers_every_remote_access_leaf_of_the_machine() {
    assert_eq!(remote_access_subject("m-1"), "machine.m-1.remote-access.>");
}
