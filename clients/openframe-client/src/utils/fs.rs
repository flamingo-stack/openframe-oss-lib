use std::io::Write;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use serde::de::DeserializeOwned;
use tempfile::NamedTempFile;
use tracing::warn;

/// Write `contents` to `path` atomically via a same-dir temp file + rename, so a concurrent
/// writer or reader never observes a torn file.
pub fn atomic_write(path: &Path, contents: impl AsRef<[u8]>) -> Result<()> {
    let parent = path.parent().context("path has no parent directory")?;
    std::fs::create_dir_all(parent)?;

    let mut tmp = NamedTempFile::new_in(parent)
        .with_context(|| format!("failed to create temp file in {}", parent.display()))?;
    tmp.write_all(contents.as_ref())?;
    // NamedTempFile defaults to 0o600; restore fs::write's 0o644 so user processes can read.
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        tmp.as_file()
            .set_permissions(std::fs::Permissions::from_mode(0o644))?;
    }
    // Without the flush a power loss can keep the rename but drop the data, leaving a NUL-filled file.
    tmp.as_file()
        .sync_all()
        .with_context(|| format!("failed to flush temp file for {}", path.display()))?;
    // persist() atomically replaces any existing file at `path` (MoveFileEx on Windows).
    let persisted: Result<()> = match tmp.persist(path) {
        Ok(_) => Ok(()),
        #[cfg(windows)]
        Err(e) if held_target::is_held(&e.error) => {
            held_target::replace(e.file, path).map_err(Into::into)
        }
        Err(e) => Err(e.into()),
    };
    persisted.with_context(|| format!("failed to persist temp file to {}", path.display()))
}

/// Replacing a file that another process (an AV scan, a backup agent) briefly holds open.
#[cfg(windows)]
mod held_target {
    use std::io;
    use std::path::Path;
    use std::time::Duration;

    use tempfile::NamedTempFile;
    use tracing::{info, warn};

    use crate::platform::file_lock::{format_locking_processes, get_locking_processes};

    /// About 3 s in all, to outlast a short exclusive hold; the caller's thread blocks meanwhile.
    pub(super) const RETRY_DELAYS: [Duration; 5] = [
        Duration::from_millis(100),
        Duration::from_millis(200),
        Duration::from_millis(400),
        Duration::from_millis(800),
        Duration::from_millis(1600),
    ];

    /// ERROR_ACCESS_DENIED or ERROR_SHARING_VIOLATION: another open handle is in the way.
    pub(super) fn is_held(error: &io::Error) -> bool {
        matches!(error.raw_os_error(), Some(5 | 32))
    }

    /// std's rename retries a denied replace with POSIX semantics, which works while the holder shares delete access.
    pub(super) fn replace(tmp: NamedTempFile, path: &Path) -> io::Result<()> {
        // Closes our handle and clears the FILE_ATTRIBUTE_TEMPORARY that the failed persist() put back.
        let tmp_path = tmp.into_temp_path().keep().map_err(|e| e.error)?;

        let mut attempts = 1;
        let mut result = std::fs::rename(&tmp_path, path);
        for delay in RETRY_DELAYS {
            match &result {
                Err(e) if is_held(e) => {}
                _ => break,
            }
            std::thread::sleep(delay);
            attempts += 1;
            result = std::fs::rename(&tmp_path, path);
        }

        match &result {
            Ok(()) => info!(
                "Replaced {} by rename on attempt {} after the plain replace was denied",
                path.display(),
                attempts
            ),
            Err(e) => {
                warn!(
                    "Could not replace {} after {} rename attempts ({}); held by: {}",
                    path.display(),
                    attempts,
                    e,
                    holders(path)
                );
                if let Err(remove_err) = std::fs::remove_file(&tmp_path) {
                    warn!(
                        "Failed to remove temp file {}: {}",
                        tmp_path.display(),
                        remove_err
                    );
                }
            }
        }
        result
    }

    pub(super) fn holders(path: &Path) -> String {
        match get_locking_processes(&path.to_string_lossy()) {
            Ok(processes) => format_locking_processes(&processes),
            Err(e) => format!("unknown ({e})"),
        }
    }
}

/// How a JSON file read back.
#[derive(Debug, PartialEq)]
pub enum JsonFile<T> {
    Missing,
    /// Didn't parse; already logged and moved aside.
    Corrupt,
    Parsed(T),
}

impl<T> JsonFile<T> {
    /// The parsed value; a missing or corrupt file reads as `None`.
    pub fn parsed(self) -> Option<T> {
        match self {
            JsonFile::Parsed(value) => Some(value),
            JsonFile::Missing | JsonFile::Corrupt => None,
        }
    }
}

/// Read `path` as JSON, moving a file that doesn't parse aside (see [`parse_json_or_quarantine`]).
pub fn read_json_or_quarantine<T: DeserializeOwned>(path: &Path) -> Result<JsonFile<T>> {
    match std::fs::read(path) {
        Ok(bytes) => Ok(parse_json_or_quarantine(path, &bytes)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(JsonFile::Missing),
        Err(e) => Err(e).with_context(|| format!("failed to read {}", path.display())),
    }
}

/// Parse `bytes` read from `path`; on failure log it and rename the file to `<name>.corrupt` so the next write starts fresh.
pub fn parse_json_or_quarantine<T: DeserializeOwned>(path: &Path, bytes: &[u8]) -> JsonFile<T> {
    let parse_error = match serde_json::from_slice(bytes) {
        Ok(value) => return JsonFile::Parsed(value),
        Err(e) => e,
    };

    let quarantine = quarantine_path(path);
    let all_zero = !bytes.is_empty() && bytes.iter().all(|b| *b == 0);
    match std::fs::rename(path, &quarantine) {
        Ok(()) => warn!(
            path = %path.display(),
            size = bytes.len(),
            all_zero,
            "Corrupt JSON file moved to {}, starting fresh: {}",
            quarantine.display(),
            parse_error
        ),
        Err(e) => warn!(
            path = %path.display(),
            size = bytes.len(),
            all_zero,
            "Corrupt JSON file could not be moved aside ({}), starting fresh: {}",
            e,
            parse_error
        ),
    }
    JsonFile::Corrupt
}

fn quarantine_path(path: &Path) -> PathBuf {
    let mut name = path.file_name().unwrap_or_default().to_os_string();
    name.push(".corrupt");
    path.with_file_name(name)
}

#[cfg(test)]
#[path = "fs_tests.rs"]
mod tests;
