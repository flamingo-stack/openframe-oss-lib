use super::*;
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

struct Holder {
    child: Child,
    dir: PathBuf,
}

impl Drop for Holder {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
        let _ = std::fs::remove_dir_all(&self.dir);
    }
}

fn hold_file(name: &str) -> (Holder, PathBuf) {
    let dir = std::env::temp_dir().join(format!(
        "openframe-file-lock-{}-{}",
        name,
        std::process::id()
    ));
    std::fs::create_dir_all(&dir).unwrap();
    let file = dir.join("held.bin");
    std::fs::write(&file, b"x").unwrap();

    let script = format!(
        "$f = [IO.File]::Open('{}', 'Open', 'ReadWrite', 'None'); Start-Sleep 60",
        file.display()
    );
    let child = Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .unwrap();
    let holder = Holder { child, dir };

    let deadline = Instant::now() + Duration::from_secs(20);
    while std::fs::File::open(&file).is_ok() {
        assert!(Instant::now() < deadline, "child never acquired the file");
        std::thread::sleep(Duration::from_millis(100));
    }
    (holder, file)
}

#[test]
fn get_locking_processes_reports_a_live_holder() {
    let (holder, file) = hold_file("single");

    let processes = get_locking_processes(&file.to_string_lossy()).unwrap();

    assert!(
        processes.iter().any(|p| p.pid == holder.child.id()),
        "holder pid {} not in {:?}",
        holder.child.id(),
        processes.iter().map(|p| p.pid).collect::<Vec<_>>()
    );
}

#[test]
fn get_directory_lock_holders_reports_a_live_holder() {
    let (holder, _file) = hold_file("dir");

    let holders = get_directory_lock_holders(&holder.dir).unwrap();

    assert!(
        holders.iter().any(|h| h.pid == holder.child.id()),
        "holder pid {} not in {:?}",
        holder.child.id(),
        holders.iter().map(|h| h.pid).collect::<Vec<_>>()
    );
}

#[test]
fn get_directory_lock_holders_is_empty_without_holders() {
    let dir = std::env::temp_dir().join(format!("openframe-file-lock-free-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(dir.join("free.bin"), b"x").unwrap();

    let holders = get_directory_lock_holders(&dir).unwrap();
    let _ = std::fs::remove_dir_all(&dir);

    assert!(holders.is_empty());
}
