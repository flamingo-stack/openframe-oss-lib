use super::*;

const SHA256_ABC: &str = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

#[test]
fn hashes_file_contents_as_lower_case_hex() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("abc.bin");
    std::fs::write(&path, b"abc").unwrap();

    assert_eq!(sha256_file(&path).unwrap(), SHA256_ABC);
}

#[test]
fn hashes_files_larger_than_one_block() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("big.bin");
    std::fs::write(&path, vec![0x5au8; 1 << 20]).unwrap();

    let expected = format!("{:x}", Sha256::digest(vec![0x5au8; 1 << 20]));
    assert_eq!(sha256_file(&path).unwrap(), expected);
}

#[test]
fn missing_file_is_an_error() {
    let dir = tempfile::tempdir().unwrap();
    let error = sha256_file(&dir.path().join("missing")).unwrap_err();
    assert!(error.to_string().contains("missing"), "{error:#}");
}

#[test]
fn current_exe_hash_matches_the_test_binary_on_disk() {
    let hash = current_exe_sha256().expect("the test binary is readable");
    assert_eq!(hash.len(), 64);
    assert!(hash
        .chars()
        .all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase()));

    let on_disk = sha256_file(&std::env::current_exe().unwrap()).unwrap();
    assert_eq!(hash, on_disk);
}
