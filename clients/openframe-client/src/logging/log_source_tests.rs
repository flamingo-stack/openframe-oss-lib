use super::*;
use std::fs::File;
use std::io::Write;
use tempfile::TempDir;

#[test]
fn test_file_log_source_reads_and_commits() {
    let tmp = TempDir::new().unwrap();
    let log_path = tmp.path().join("test.log");
    let offset_path = tmp.path().join("offset");

    let mut file = File::create(&log_path).unwrap();
    writeln!(
        file,
        "2026-04-06T14:15:10.488Z INFO openframe::test: message 1"
    )
    .unwrap();
    writeln!(
        file,
        "2026-04-06T14:15:11.488Z WARN openframe::test: message 2"
    )
    .unwrap();

    let mut source = FileLogSource::new(LogSourceKind::Openframe, log_path, offset_path.clone());
    let entries = source.read(10).unwrap();

    assert_eq!(entries.len(), 2);
    source.commit();
    assert!(offset_path.exists());
}

#[test]
fn test_file_log_source_returns_error_on_missing_file() {
    let tmp = TempDir::new().unwrap();
    let log_path = tmp.path().join("nonexistent.log");
    let offset_path = tmp.path().join("offset");

    let mut source = FileLogSource::new(LogSourceKind::Meshcentral, log_path, offset_path);
    assert!(source.read(10).is_err());
}

#[test]
fn test_file_log_source_rollback() {
    let tmp = TempDir::new().unwrap();
    let log_path = tmp.path().join("test.log");
    let offset_path = tmp.path().join("offset");

    let mut file = File::create(&log_path).unwrap();
    writeln!(file, "2026-04-06T14:15:10.488Z INFO openframe::test: msg").unwrap();

    let mut source = FileLogSource::new(LogSourceKind::Openframe, log_path, offset_path);

    let entries1 = source.read(10).unwrap();
    source.rollback();
    let entries2 = source.read(10).unwrap();

    assert_eq!(entries1[0].msg, entries2[0].msg);
}

#[test]
fn test_registry_distributes_reads_across_sources() {
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;

    struct MockLogSource {
        name: String,
        logs_available: Arc<AtomicUsize>,
    }

    impl MockLogSource {
        fn new(name: &str, available: usize) -> Self {
            Self {
                name: name.to_string(),
                logs_available: Arc::new(AtomicUsize::new(available)),
            }
        }
    }

    impl LogSource for MockLogSource {
        fn name(&self) -> &str {
            &self.name
        }
        fn read(&mut self, max_count: usize) -> Result<Vec<LogEntry>> {
            let available = self.logs_available.load(Ordering::SeqCst);
            let to_read = max_count.min(available);
            self.logs_available.fetch_sub(to_read, Ordering::SeqCst);

            Ok((0..to_read)
                .map(|i| LogEntry {
                    ts: format!("2026-04-06T14:15:{:02}.000Z", i),
                    level: "INFO".to_string(),
                    msg: format!("{}::log_{}", self.name, i),
                    count: None,
                })
                .collect())
        }
        fn commit(&mut self) {}
        fn rollback(&mut self) {}
    }

    let mut registry = LogSourceRegistry::new();
    registry.register(Box::new(MockLogSource::new("source1", 100)));
    registry.register(Box::new(MockLogSource::new("source2", 100)));

    let logs = registry.read_all(50);
    assert!(logs.len() <= 50);
}

#[test]
fn a_chat_source_reads_chat_lines_as_chat_entries() {
    let tmp = TempDir::new().unwrap();
    let log_path = tmp.path().join("openframe-chat.log");
    std::fs::write(
        &log_path,
        "[2026-11-25][01:00:00][INFO][app_lib] first\n[2026-11-25][01:00:01][ERROR][app_lib] second\n",
    )
    .unwrap();

    let mut source = FileLogSource::new(
        LogSourceKind::OpenframeChat,
        log_path,
        tmp.path().join("chat_offset"),
    );

    let entries = source.read(10).unwrap();
    assert_eq!(entries.len(), 2);
    assert_eq!(entries[1].msg, "[chat] app_lib: second");
    assert_eq!(entries[1].level, "ERROR");
}

fn line(n: u32) -> String {
    format!("2026-04-06T14:15:1{n}.488Z INFO openframe::test: message {n}\n")
}

fn source_for(tmp: &TempDir, log_path: PathBuf) -> FileLogSource {
    FileLogSource::new(
        LogSourceKind::OpenframeChat,
        log_path,
        tmp.path().join("offset"),
    )
}

#[test]
fn a_batch_cut_short_continues_at_the_first_unread_line() {
    let tmp = TempDir::new().unwrap();
    let log_path = tmp.path().join("test.log");
    std::fs::write(&log_path, format!("{}{}{}", line(1), line(2), line(3))).unwrap();
    let mut source = source_for(&tmp, log_path);

    let first = source.read(1).unwrap();
    let rest = source.read(10).unwrap();

    assert_eq!(first[0].msg, "openframe::test: message 1");
    let rest: Vec<_> = rest.iter().map(|e| e.msg.as_str()).collect();
    assert_eq!(
        rest,
        ["openframe::test: message 2", "openframe::test: message 3"]
    );
}

#[test]
fn a_half_written_last_line_waits_for_its_end() {
    let tmp = TempDir::new().unwrap();
    let log_path = tmp.path().join("test.log");
    std::fs::write(
        &log_path,
        format!("{}2026-04-06T14:15:12.488Z INFO", line(1)),
    )
    .unwrap();
    let mut source = source_for(&tmp, log_path.clone());

    assert_eq!(source.read(10).unwrap().len(), 1);

    let mut file = std::fs::OpenOptions::new()
        .append(true)
        .open(&log_path)
        .unwrap();
    file.write_all(b" openframe::test: message 2\n").unwrap();

    let entries = source.read(10).unwrap();
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].msg, "openframe::test: message 2");
}

#[test]
fn a_line_longer_than_the_limit_is_skipped() {
    let tmp = TempDir::new().unwrap();
    let log_path = tmp.path().join("test.log");
    let long = format!(
        "2026-04-06T14:15:10.488Z INFO openframe::test: {}\n",
        "x".repeat(MAX_LINE_BYTES as usize)
    );
    std::fs::write(&log_path, format!("{long}{}", line(2))).unwrap();
    let mut source = source_for(&tmp, log_path);

    let entries = source.read(10).unwrap();

    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].msg, "openframe::test: message 2");
}

#[cfg(unix)]
#[test]
fn a_symlinked_log_is_refused() {
    let tmp = TempDir::new().unwrap();
    let target = tmp.path().join("target.log");
    std::fs::write(&target, line(1)).unwrap();
    let log_path = tmp.path().join("test.log");
    std::os::unix::fs::symlink(&target, &log_path).unwrap();

    assert!(source_for(&tmp, log_path).read(10).is_err());
}

#[cfg(unix)]
#[test]
fn a_hard_linked_log_is_refused() {
    let tmp = TempDir::new().unwrap();
    let target = tmp.path().join("target.log");
    std::fs::write(&target, line(1)).unwrap();
    let log_path = tmp.path().join("test.log");
    std::fs::hard_link(&target, &log_path).unwrap();

    assert!(source_for(&tmp, log_path).read(10).is_err());
}

#[cfg(unix)]
#[test]
fn a_fifo_in_place_of_the_log_is_refused_without_blocking() {
    let tmp = TempDir::new().unwrap();
    let log_path = tmp.path().join("test.log");
    let c_path = std::ffi::CString::new(log_path.to_str().unwrap()).unwrap();
    assert_eq!(unsafe { libc::mkfifo(c_path.as_ptr(), 0o644) }, 0);
    let mut source = source_for(&tmp, log_path);

    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let _ = tx.send(source.read(10).is_err());
    });

    let refused = rx
        .recv_timeout(std::time::Duration::from_secs(5))
        .expect("reading a FIFO blocked");
    assert!(refused);
}
