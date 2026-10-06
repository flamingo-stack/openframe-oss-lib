use super::*;

#[test]
fn aside_path_appends_old_to_full_filename() {
    assert_eq!(
        aside_path(Path::new(r"C:\x\agent.exe")),
        PathBuf::from(r"C:\x\agent.exe.old")
    );
    assert_eq!(
        aside_path(Path::new("/x/agent")),
        PathBuf::from("/x/agent.old")
    );
}

// 3 MB spans several tokio write chunks, so the flush after the last chunk is what closes the handle.
#[tokio::test]
async fn write_executable_persists_bytes_and_releases_the_handle() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("agent.bin");
    let bytes: Vec<u8> = (0..3 * 1024 * 1024).map(|i| (i % 251) as u8).collect();

    write_executable(&bytes, &path).await.unwrap();

    assert_eq!(std::fs::read(&path).unwrap(), bytes);
    // Polled, not a single open: the CI runner's AV may still be scanning the file on close.
    #[cfg(target_os = "windows")]
    assert!(
        wait_until_executable_unlocked(&path, Duration::from_secs(10)).await,
        "write_executable must close its handle before returning"
    );
    #[cfg(target_family = "unix")]
    {
        use std::os::unix::fs::PermissionsExt;
        let mode = std::fs::metadata(&path).unwrap().permissions().mode();
        assert_eq!(mode & 0o777, 0o755);
    }
}

#[cfg(target_os = "windows")]
#[tokio::test]
async fn unlock_probe_reports_a_held_file_then_a_released_one() {
    use std::io::Write;
    use std::os::windows::fs::OpenOptionsExt;
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("agent.exe");

    // Create through the holder itself so no close (and no AV scan-on-close) happens before we hold it.
    let mut holder = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .share_mode(0)
        .open(&path)
        .unwrap();
    holder.write_all(b"MZ").unwrap();
    assert!(!wait_until_executable_unlocked(&path, Duration::from_millis(600)).await);

    drop(holder);
    let started = std::time::Instant::now();
    assert!(wait_until_executable_unlocked(&path, Duration::from_secs(10)).await);
    assert!(started.elapsed() < Duration::from_secs(5));
}

#[cfg(target_os = "windows")]
#[tokio::test]
async fn unlock_probe_lets_a_missing_file_through_immediately() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("missing.exe");
    let started = std::time::Instant::now();
    assert!(wait_until_executable_unlocked(&path, Duration::from_secs(5)).await);
    assert!(started.elapsed() < Duration::from_secs(1));
}
