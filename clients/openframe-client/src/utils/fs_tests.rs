use super::*;

#[cfg(unix)]
#[test]
fn atomic_write_sets_644_and_self_heals() {
    use std::os::unix::fs::PermissionsExt;

    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("token.enc");

    atomic_write(&path, b"first").unwrap();
    assert_eq!(
        std::fs::metadata(&path).unwrap().permissions().mode() & 0o777,
        0o644
    );

    // A pre-existing owner-only file must be corrected on the next write, not preserved.
    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600)).unwrap();
    atomic_write(&path, b"second").unwrap();
    assert_eq!(
        std::fs::metadata(&path).unwrap().permissions().mode() & 0o777,
        0o644
    );
    assert_eq!(std::fs::read(&path).unwrap(), b"second");
}

#[test]
fn atomic_write_replaces_a_corrupt_file() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("state.json");
    std::fs::write(&path, [0u8; 64]).unwrap();

    atomic_write(&path, br#"{"a":1}"#).unwrap();

    assert_eq!(std::fs::read(&path).unwrap(), br#"{"a":1}"#);
    assert_eq!(std::fs::read_dir(dir.path()).unwrap().count(), 1);
}

#[cfg(windows)]
mod held_target_replace {
    use super::*;
    use std::fs::{File, OpenOptions};
    use std::os::windows::fs::{MetadataExt, OpenOptionsExt};
    use std::process::{Command, Stdio};
    use std::time::{Duration, Instant};

    const FILE_SHARE_READ: u32 = 0x1;
    const FILE_SHARE_WRITE: u32 = 0x2;
    const FILE_SHARE_DELETE: u32 = 0x4;
    const FILE_ATTRIBUTE_TEMPORARY: u32 = 0x100;

    fn hold(path: &Path, share_mode: u32) -> File {
        OpenOptions::new()
            .read(true)
            .share_mode(share_mode)
            .open(path)
            .unwrap()
    }

    fn assert_only_file(dir: &Path, path: &Path, contents: &[u8]) {
        assert_eq!(std::fs::read(path).unwrap(), contents);
        assert_eq!(
            std::fs::metadata(path).unwrap().file_attributes() & FILE_ATTRIBUTE_TEMPORARY,
            0
        );
        assert_eq!(std::fs::read_dir(dir).unwrap().count(), 1);
    }

    #[test]
    fn a_holder_that_shares_delete_access_does_not_block_the_replace() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("update_state.json");
        atomic_write(&path, b"first").unwrap();
        let holder = hold(
            &path,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
        );

        atomic_write(&path, b"second").unwrap();

        drop(holder);
        assert_only_file(dir.path(), &path, b"second");
    }

    #[test]
    fn the_retries_outlast_a_short_exclusive_hold() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("update_state.json");
        atomic_write(&path, b"first").unwrap();
        let (held_tx, held_rx) = std::sync::mpsc::channel();
        let holder = std::thread::spawn({
            let path = path.clone();
            move || {
                let file = hold(&path, FILE_SHARE_READ | FILE_SHARE_WRITE);
                held_tx.send(()).unwrap();
                std::thread::sleep(Duration::from_millis(300));
                let released_at = Instant::now();
                drop(file);
                released_at
            }
        });
        held_rx.recv().unwrap();

        atomic_write(&path, b"second").unwrap();

        let written_at = Instant::now();
        assert!(written_at >= holder.join().unwrap());
        assert_only_file(dir.path(), &path, b"second");
    }

    #[test]
    fn a_long_exclusive_hold_fails_with_the_original_error_and_leaves_no_temp_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("update_state.json");
        atomic_write(&path, b"first").unwrap();
        let holder = hold(&path, FILE_SHARE_READ | FILE_SHARE_WRITE);
        let started = Instant::now();

        let err = format!("{:#}", atomic_write(&path, b"second").unwrap_err());

        assert!(started.elapsed() >= held_target::RETRY_DELAYS.iter().sum::<Duration>());
        drop(holder);
        let wording = format!("failed to persist temp file to {}", path.display());
        assert!(err.contains(&wording), "{err}");
        assert!(err.contains("os error 5"), "{err}");
        assert_only_file(dir.path(), &path, b"first");
    }

    #[test]
    fn holders_name_the_process_that_has_the_file_open() {
        let dir = tempfile::tempdir().unwrap();
        let image = dir.path().join("held.exe");
        let system_root = std::env::var("SystemRoot").unwrap_or_else(|_| r"C:\Windows".into());
        std::fs::copy(Path::new(&system_root).join(r"System32\PING.EXE"), &image).unwrap();
        let mut child = Command::new(&image)
            .args(["-n", "60", "127.0.0.1"])
            .stdout(Stdio::null())
            .spawn()
            .unwrap();

        let holders = held_target::holders(&image);

        let _ = child.kill();
        let _ = child.wait();
        assert!(
            holders.contains(&format!("(PID: {})", child.id())),
            "{holders}"
        );
    }
}

#[derive(serde::Deserialize, Debug, PartialEq)]
struct Sample {
    a: u32,
}

#[test]
fn read_json_or_quarantine_reports_a_missing_file() {
    let dir = tempfile::tempdir().unwrap();
    let read: JsonFile<Sample> = read_json_or_quarantine(&dir.path().join("absent.json")).unwrap();
    assert_eq!(read, JsonFile::Missing);
}

#[test]
fn read_json_or_quarantine_parses_a_valid_file_and_leaves_it_in_place() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("ok.json");
    std::fs::write(&path, br#"{"a":7}"#).unwrap();

    let read: JsonFile<Sample> = read_json_or_quarantine(&path).unwrap();

    assert_eq!(read, JsonFile::Parsed(Sample { a: 7 }));
    assert!(path.exists());
    assert!(!dir.path().join("ok.json.corrupt").exists());
}

fn assert_quarantined(contents: &[u8]) {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("bad.json");
    std::fs::write(&path, contents).unwrap();

    let read: JsonFile<Sample> = read_json_or_quarantine(&path).unwrap();

    assert_eq!(read, JsonFile::Corrupt);
    assert!(!path.exists());
    assert_eq!(
        std::fs::read(dir.path().join("bad.json.corrupt")).unwrap(),
        contents
    );
}

#[test]
fn read_json_or_quarantine_moves_aside_a_nul_filled_file() {
    assert_quarantined(&[0u8; 128]);
}

#[test]
fn read_json_or_quarantine_moves_aside_an_empty_file() {
    assert_quarantined(b"");
}

#[test]
fn read_json_or_quarantine_moves_aside_a_truncated_file() {
    assert_quarantined(br#"[{"a":"#);
}

#[test]
fn read_json_or_quarantine_moves_aside_a_file_that_is_not_utf8() {
    assert_quarantined(&[0xff, 0xfe, 0x7b, 0x7d]);
}

#[test]
fn read_json_or_quarantine_replaces_an_older_quarantined_copy() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("bad.json");
    std::fs::write(dir.path().join("bad.json.corrupt"), b"old").unwrap();
    std::fs::write(&path, b"new garbage").unwrap();

    let read: JsonFile<Sample> = read_json_or_quarantine(&path).unwrap();

    assert_eq!(read, JsonFile::Corrupt);
    assert_eq!(
        std::fs::read(dir.path().join("bad.json.corrupt")).unwrap(),
        b"new garbage"
    );
}
