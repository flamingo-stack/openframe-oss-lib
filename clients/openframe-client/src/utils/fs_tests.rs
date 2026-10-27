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
