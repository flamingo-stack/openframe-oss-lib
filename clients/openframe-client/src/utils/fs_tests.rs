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

#[cfg(windows)]
mod windows_held_target {
    use super::*;
    use std::os::windows::fs::{MetadataExt, OpenOptionsExt};
    use std::time::{Duration, Instant};

    const SHARE_READ_WRITE: u32 = 0x1 | 0x2;
    const SHARE_DELETE: u32 = 0x4;
    const FILE_ATTRIBUTE_TEMPORARY: u32 = 0x100;

    /// Holds `path` open the way an on-access scanner does.
    fn hold(path: &Path, share: u32) -> std::fs::File {
        std::fs::OpenOptions::new()
            .read(true)
            .share_mode(share)
            .open(path)
            .unwrap()
    }

    fn files_in(dir: &Path) -> Vec<String> {
        std::fs::read_dir(dir)
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .collect()
    }

    #[test]
    fn a_target_held_with_delete_sharing_is_replaced() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("update_state.json");
        atomic_write(&path, "first").unwrap();
        let holder = hold(&path, SHARE_READ_WRITE | SHARE_DELETE);

        atomic_write(&path, "second").unwrap();
        drop(holder);

        assert_eq!(std::fs::read_to_string(&path).unwrap(), "second");
        let attributes = std::fs::metadata(&path).unwrap().file_attributes();
        assert_eq!(attributes & FILE_ATTRIBUTE_TEMPORARY, 0);
        assert_eq!(files_in(dir.path()), ["update_state.json"]);
    }

    #[test]
    fn a_short_exclusive_hold_is_waited_out() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("update_state.json");
        atomic_write(&path, "first").unwrap();
        let holder = hold(&path, SHARE_READ_WRITE);
        let release = std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(300));
            drop(holder);
        });

        atomic_write(&path, "second").unwrap();
        release.join().unwrap();

        assert_eq!(std::fs::read_to_string(&path).unwrap(), "second");
    }

    #[test]
    fn a_target_held_exclusively_fails_after_the_retries_and_leaves_no_staged_copy() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("update_state.json");
        atomic_write(&path, "first").unwrap();
        let holder = hold(&path, SHARE_READ_WRITE);

        let started = Instant::now();
        let err = atomic_write(&path, "second").unwrap_err();
        let waited = started.elapsed();
        drop(holder);

        assert!(format!("{err:#}").contains("os error 5"), "{err:#}");
        assert!(
            waited >= Duration::from_millis(1400),
            "gave up after {waited:?}"
        );
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "first");
        assert_eq!(files_in(dir.path()), ["update_state.json"]);
    }
}
