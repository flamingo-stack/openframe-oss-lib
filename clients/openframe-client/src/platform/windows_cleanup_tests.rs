use super::{generate_binary_cleanup_script, get_powershell_path};
use std::fs;
use std::process::Command;

#[test]
fn script_removes_binary_install_dirs_and_itself() {
    let root = tempfile::tempdir().unwrap();
    let install_dir = root.path().join("Open'Frame");
    let bin_dir = install_dir.join("bin");
    let staging_dir = install_dir.join("update");
    fs::create_dir_all(&bin_dir).unwrap();
    fs::create_dir_all(&staging_dir).unwrap();
    let binary = bin_dir.join("openframe-client.exe");
    fs::write(&binary, b"x").unwrap();

    let mut exited = Command::new("cmd").args(["/C", "exit"]).spawn().unwrap();
    exited.wait().unwrap();

    let script = staging_dir.join("cleanup.ps1");
    fs::write(
        &script,
        generate_binary_cleanup_script(&binary, exited.id(), Some(&bin_dir), &staging_dir),
    )
    .unwrap();

    let status = Command::new(get_powershell_path())
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File"])
        .arg(&script)
        .status()
        .unwrap();

    assert!(status.success());
    assert!(!install_dir.exists());
    assert!(!script.exists());
}
