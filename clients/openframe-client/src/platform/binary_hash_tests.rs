use super::*;

fn write_temp(dir: &tempfile::TempDir, name: &str, content: &[u8]) -> std::path::PathBuf {
    let path = dir.path().join(name);
    std::fs::write(&path, content).unwrap();
    path
}

#[test]
fn hashes_known_content() {
    let dir = tempfile::tempdir().unwrap();
    let path = write_temp(&dir, "abc.bin", b"abc");
    assert_eq!(
        file_sha256(&path).unwrap(),
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
}

#[test]
fn hashes_empty_file() {
    let dir = tempfile::tempdir().unwrap();
    let path = write_temp(&dir, "empty.bin", b"");
    assert_eq!(
        file_sha256(&path).unwrap(),
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
}

#[test]
fn fails_on_missing_file() {
    let dir = tempfile::tempdir().unwrap();
    assert!(file_sha256(&dir.path().join("missing")).is_err());
}

#[test]
fn running_binary_hash_or_warn_matches_the_fallible_hash() {
    assert_eq!(
        running_binary_sha256_or_warn(),
        Some(running_binary_sha256().unwrap())
    );
}

#[test]
fn hashes_running_binary_as_lowercase_hex() {
    let hash = running_binary_sha256().unwrap();
    assert_eq!(hash.len(), 64);
    assert!(hash
        .chars()
        .all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase()));
}
