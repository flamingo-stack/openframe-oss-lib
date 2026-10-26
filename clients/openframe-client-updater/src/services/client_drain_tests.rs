use super::*;

fn drain() -> (tempfile::TempDir, ClientDrain) {
    let dir = tempfile::tempdir().unwrap();
    let drain = ClientDrain::at(dir.path().join("client_drained"));
    (dir, drain)
}

#[tokio::test]
async fn a_confirmation_for_this_update_ends_the_wait() {
    let (dir, drain) = drain();
    fs::write(
        dir.path().join("client_drained"),
        b"2026-10-27T10:00:00.123Z",
    )
    .unwrap();

    assert!(drain.wait("2026-10-27T10:00:00.123Z").await);
}

#[test]
fn only_this_updates_token_confirms() {
    let (dir, drain) = drain();
    assert!(!drain.confirmed("t2"), "no marker yet");

    fs::write(dir.path().join("client_drained"), b"t1").unwrap();
    assert!(!drain.confirmed("t2"), "an earlier update's marker");

    fs::write(dir.path().join("client_drained"), b"t2").unwrap();
    assert!(drain.confirmed("t2"));
}

#[test]
fn clear_removes_the_marker_and_tolerates_absence() {
    let (dir, drain) = drain();
    drain.clear();

    fs::write(dir.path().join("client_drained"), b"t1").unwrap();
    drain.clear();
    assert!(!dir.path().join("client_drained").exists());
}
