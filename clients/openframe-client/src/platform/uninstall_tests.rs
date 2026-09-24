use super::{remove_binary_siblings, remove_orbit_dir};
use std::fs;
use std::path::Path;

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
fn removes_update_leftovers_next_to_windows_binary() {
    let dir = tempfile::tempdir().unwrap();
    for name in [
        "openframe-client.exe",
        "openframe-client.exe.lkg",
        "openframe-client.exe.lkg.tmp",
        "openframe-client.exe.prev",
        "openframe-client.exe.old",
        "openframe-client.exe.bak",
        "openframe-client.exe.bad",
        "openframe-client.exe.backup.1700000000",
        "openframe-client-updater.exe",
        "openframe-client-updater.exe.lkg",
        "openframe.cmd",
    ] {
        touch(dir.path(), name);
    }

    remove_binary_siblings(&dir.path().join("openframe-client.exe"));

    assert_eq!(
        remaining(dir.path()),
        vec![
            "openframe-client-updater.exe",
            "openframe-client-updater.exe.lkg",
            "openframe-client.exe",
            "openframe.cmd",
        ]
    );
}

#[test]
fn removes_update_leftovers_next_to_unix_binary() {
    let dir = tempfile::tempdir().unwrap();
    for name in [
        "openframe-client",
        "openframe-client.lkg",
        "openframe-client.prev",
        "openframe-client.backup.1700000000",
        "openframe-client-updater",
        "openframe",
    ] {
        touch(dir.path(), name);
    }

    remove_binary_siblings(&dir.path().join("openframe-client"));

    assert_eq!(
        remaining(dir.path()),
        vec!["openframe", "openframe-client", "openframe-client-updater"]
    );
}

#[test]
fn missing_directory_is_ignored() {
    let dir = tempfile::tempdir().unwrap();
    remove_binary_siblings(&dir.path().join("missing").join("openframe-client"));
}

#[tokio::test]
async fn removes_orbit_directory_with_enrollment_state() {
    let dir = tempfile::tempdir().unwrap();
    let orbit = dir.path().join("orbit");
    fs::create_dir_all(orbit.join("osquery.db")).unwrap();
    touch(&orbit, "secret-orbit-node-key.txt");
    touch(&orbit.join("osquery.db"), "CURRENT");

    remove_orbit_dir(&orbit).await;

    assert!(!orbit.exists());
    assert!(dir.path().exists());
}

#[tokio::test]
async fn missing_orbit_directory_is_ignored() {
    let dir = tempfile::tempdir().unwrap();
    remove_orbit_dir(&dir.path().join("orbit")).await;
}
