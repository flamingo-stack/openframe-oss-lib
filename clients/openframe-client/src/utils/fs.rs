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
    tmp.persist(path)
        .with_context(|| format!("failed to persist temp file to {}", path.display()))?;
    Ok(())
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
