use super::{generate_binary_cleanup_script, get_powershell_path};
use std::fs;
use std::process::Command;

#[test]
fn script_removes_binary_install_dirs_and_itself() {
    let root = tempfile::tempdir().unwrap();
    let install_dir = root.path().join("Open'Frame");
    let bin_dir = install_dir.join("bin");
    fs::create_dir_all(&bin_dir).unwrap();
    let binary = bin_dir.join("openframe-client.exe");
    fs::write(&binary, b"x").unwrap();

    let mut exited = Command::new("cmd").args(["/C", "exit"]).spawn().unwrap();
    exited.wait().unwrap();

    let script = root.path().join("cleanup.ps1");
    fs::write(
        &script,
        generate_binary_cleanup_script(&binary, exited.id(), Some(&bin_dir)),
    )
    .unwrap();

    let status = Command::new(get_powershell_path().unwrap())
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File"])
        .arg(&script)
        .status()
        .unwrap();

    assert!(status.success());
    assert!(!install_dir.exists());
    assert!(!script.exists());
}
