use super::*;

fn rotated(path: &std::path::Path, index: usize) -> PathBuf {
    PathBuf::from(format!("{}.{}", path.display(), index))
}

#[test]
fn rotates_when_limit_is_reached_and_keeps_writing_to_the_same_path() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("openframe-client-updater.log");
    let mut log = RotatingLogFile::with_limit(path.clone(), 10).unwrap();

    log.write_all(b"0123456789").unwrap();
    log.write_all(b"second").unwrap();
    log.flush().unwrap();

    assert_eq!(std::fs::read(&path).unwrap(), b"second");
    assert_eq!(std::fs::read(rotated(&path, 1)).unwrap(), b"0123456789");
}

#[test]
fn keeps_only_the_configured_number_of_rotated_files() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("openframe-client-updater.log");
    let mut log = RotatingLogFile::with_limit(path.clone(), 4).unwrap();

    for chunk in [b"aaaa", b"bbbb", b"cccc", b"dddd", b"eeee", b"ffff"] {
        log.write_all(chunk).unwrap();
    }
    log.flush().unwrap();

    assert_eq!(std::fs::read(&path).unwrap(), b"ffff");
    assert_eq!(std::fs::read(rotated(&path, 1)).unwrap(), b"eeee");
    assert_eq!(
        std::fs::read(rotated(&path, UPDATER_LOG_KEEP_ROTATED)).unwrap(),
        b"cccc"
    );
    assert!(!rotated(&path, UPDATER_LOG_KEEP_ROTATED + 1).exists());
}

#[test]
fn resumes_size_accounting_from_an_existing_file() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("openframe-client-updater.log");
    std::fs::write(&path, b"existing").unwrap();

    let mut log = RotatingLogFile::with_limit(path.clone(), 8).unwrap();
    log.write_all(b"new").unwrap();
    log.flush().unwrap();

    assert_eq!(std::fs::read(&path).unwrap(), b"new");
    assert_eq!(std::fs::read(rotated(&path, 1)).unwrap(), b"existing");
}
