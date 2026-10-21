use super::*;

#[test]
fn hashes_file_contents_as_lowercase_hex() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("binary");
    std::fs::write(&path, b"abc").unwrap();

    assert_eq!(
        file_sha256(&path).unwrap(),
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
}

#[test]
fn hashes_files_larger_than_the_read_buffer() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("binary");
    let contents = vec![7u8; READ_BUFFER_SIZE * 3 + 5];
    std::fs::write(&path, &contents).unwrap();

    let expected = to_hex(&Sha256::digest(&contents));
    assert_eq!(file_sha256(&path).unwrap(), expected);
}

#[test]
fn missing_file_is_an_error() {
    assert!(file_sha256(Path::new("/nonexistent/openframe-client")).is_err());
}

#[tokio::test]
async fn hashes_the_running_test_binary() {
    let checksum = current_executable_sha256().await;
    let executable = std::env::current_exe().unwrap();

    assert_eq!(checksum, file_sha256(&executable).unwrap());
    assert_eq!(checksum.len(), 64);
}
