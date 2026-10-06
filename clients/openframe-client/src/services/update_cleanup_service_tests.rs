use super::*;

fn touch(dir: &Path, name: &str) {
    fs::write(dir.join(name), b"x").unwrap();
}

fn remaining(dir: &Path) -> Vec<String> {
    let mut names: Vec<String> = fs::read_dir(dir)
        .unwrap()
        .map(|e| e.unwrap().file_name().to_string_lossy().to_string())
        .collect();
    names.sort();
    names
}

#[test]
fn remove_pre_swap_copy_only_touches_prev() {
    let dir = tempfile::tempdir().unwrap();
    for name in [
        "openframe-client.exe",
        "openframe-client.exe.prev",
        "openframe-client.exe.lkg",
    ] {
        touch(dir.path(), name);
    }

    let svc = UpdateCleanupService::for_binary(dir.path().join("openframe-client.exe"));
    svc.remove_pre_swap_copy();
    svc.remove_pre_swap_copy();

    assert_eq!(
        remaining(dir.path()),
        vec!["openframe-client.exe", "openframe-client.exe.lkg"]
    );
}

#[test]
fn old_backups_are_removed_by_the_routine_cleanup() {
    let dir = tempfile::tempdir().unwrap();
    for name in [
        "openframe-client",
        "openframe-client.backup.1700000000",
        "openframe-client.lkg",
    ] {
        touch(dir.path(), name);
    }

    let svc = UpdateCleanupService::for_binary(dir.path().join("openframe-client"));
    assert_eq!(svc.cleanup_all_old_backups().unwrap(), 1);

    assert_eq!(
        remaining(dir.path()),
        vec!["openframe-client", "openframe-client.lkg"]
    );
}
