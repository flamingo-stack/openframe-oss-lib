use super::*;
use std::process::{Child, Command, Stdio};

/// A copy of `ping.exe` running from `dir`; killed and reaped on drop.
struct RunningFrom(Child);

impl RunningFrom {
    fn start(dir: &Path) -> Self {
        let system_root = std::env::var("SystemRoot").unwrap_or_else(|_| r"C:\Windows".into());
        let image = dir.join("held.exe");
        std::fs::copy(Path::new(&system_root).join(r"System32\PING.EXE"), &image).unwrap();
        let child = Command::new(&image)
            .args(["-n", "60", "127.0.0.1"])
            .stdout(Stdio::null())
            .spawn()
            .unwrap();
        RunningFrom(child)
    }
}

impl Drop for RunningFrom {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

#[test]
fn directory_lock_holders_list_a_process_running_from_the_dir() {
    let dir = tempfile::tempdir().unwrap();
    let running = RunningFrom::start(dir.path());

    let holders = get_directory_lock_holders(dir.path()).unwrap();

    assert!(
        holders.iter().any(|h| h.pid == running.0.id()),
        "{holders:?}"
    );
}

#[test]
fn directory_lock_holders_are_empty_when_nothing_holds_the_dir() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("idle.exe"), b"MZ").unwrap();

    assert!(get_directory_lock_holders(dir.path()).unwrap().is_empty());
}
