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

#[cfg(target_os = "macos")]
#[tokio::test]
async fn replace_executable_swaps_in_a_new_inode() {
    use std::os::unix::fs::{MetadataExt, PermissionsExt};
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("osqueryd");
    write_executable(b"old", &path).await.unwrap();
    let old_ino = std::fs::metadata(&path).unwrap().ino();

    replace_executable(b"new", &path).await.unwrap();

    let meta = std::fs::metadata(&path).unwrap();
    assert_ne!(meta.ino(), old_ino);
    assert_eq!(meta.permissions().mode() & 0o777, 0o755);
    assert_eq!(std::fs::read(&path).unwrap(), b"new");
    assert!(!dir.path().join(".osqueryd.new").exists());
}

#[cfg(target_os = "macos")]
#[tokio::test]
#[ignore = "compiles two signed binaries with the system cc"]
async fn replaced_executable_launches_while_the_old_one_still_runs() {
    use std::os::unix::process::ExitStatusExt;
    use std::process::Command;

    let dir = tempfile::tempdir().unwrap();
    let compile = |name: &str, code: i32| {
        let src = dir.path().join(format!("{name}.c"));
        std::fs::write(
            &src,
            format!(
                "#include <unistd.h>\nint main(int c, char **v) {{ if (c > 1) sleep(5); return {code}; }}\n"
            ),
        )
        .unwrap();
        let out = dir.path().join(name);
        assert!(Command::new("cc")
            .arg("-o")
            .arg(&out)
            .arg(&src)
            .status()
            .unwrap()
            .success());
        std::fs::read(out).unwrap()
    };
    let old_bytes = compile("old", 7);
    let new_bytes = compile("new", 9);

    let in_place = dir.path().join("in_place");
    write_executable(&old_bytes, &in_place).await.unwrap();
    let mut old = Command::new(&in_place).arg("hold").spawn().unwrap();
    write_executable(&new_bytes, &in_place).await.unwrap();
    let status = Command::new(&in_place).status().unwrap();
    old.kill().unwrap();
    old.wait().unwrap();
    assert_eq!(
        status.signal(),
        Some(9),
        "in-place overwrite must reproduce the kill"
    );
    assert_eq!(
        Command::new(&in_place).status().unwrap().signal(),
        Some(9),
        "the kill outlives the old process"
    );

    let replaced = dir.path().join("replaced");
    write_executable(&old_bytes, &replaced).await.unwrap();
    let mut old = Command::new(&replaced).arg("hold").spawn().unwrap();
    replace_executable(&new_bytes, &replaced).await.unwrap();
    let status = Command::new(&replaced).status().unwrap();
    old.kill().unwrap();
    old.wait().unwrap();
    assert_eq!(status.code(), Some(9));

    replace_executable(&new_bytes, &in_place).await.unwrap();
    assert_eq!(Command::new(&in_place).status().unwrap().code(), Some(9));
}
