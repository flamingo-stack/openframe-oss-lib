use super::*;

#[test]
fn sweep_removes_staged_binaries_and_backups_only() {
    let dir = tempfile::tempdir().unwrap();
    let target = dir.path().join("openframe-client");
    let keep = [
        "openframe-client",
        "openframe-client-updater",
        "openframe-client.lkg",
        "notes.tmp",
    ];
    let sweep = [
        ".openframe-client-update-3f2a.tmp",
        "openframe-client.backup.20261027120000",
    ];
    for name in keep.iter().chain(sweep.iter()) {
        fs::write(dir.path().join(name), b"x").unwrap();
    }

    sweep_leftovers(&target);

    for name in keep {
        assert!(dir.path().join(name).exists(), "{name} was removed");
    }
    for name in sweep {
        assert!(!dir.path().join(name).exists(), "{name} was left");
    }
}

#[test]
fn remove_quietly_tolerates_a_missing_file() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("gone");
    remove_quietly(&path, "file");

    fs::write(&path, b"x").unwrap();
    remove_quietly(&path, "file");
    assert!(!path.exists());
}
