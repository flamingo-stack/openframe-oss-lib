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

/// Read `path` as JSON: `None` when it is missing, and also when it doesn't parse, after the bad
/// file is moved aside to `<name>.corrupt` so the next write starts fresh.
pub fn read_json_or_quarantine<T: DeserializeOwned>(path: &Path) -> Result<Option<T>> {
    Ok(read_json_bytes_or_quarantine(path)?.map(|(value, _)| value))
}

/// Same as [`read_json_or_quarantine`], also returning the file's text for callers that log it.
pub fn read_json_text_or_quarantine<T: DeserializeOwned>(
    path: &Path,
) -> Result<Option<(T, String)>> {
    Ok(read_json_bytes_or_quarantine(path)?
        .map(|(value, bytes)| (value, String::from_utf8_lossy(&bytes).into_owned())))
}

fn read_json_bytes_or_quarantine<T: DeserializeOwned>(path: &Path) -> Result<Option<(T, Vec<u8>)>> {
    let bytes = match std::fs::read(path) {
        Ok(bytes) => bytes,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(e).with_context(|| format!("failed to read {}", path.display())),
    };
    let parse_error = match serde_json::from_slice(&bytes) {
        Ok(value) => return Ok(Some((value, bytes))),
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
    Ok(None)
}

fn quarantine_path(path: &Path) -> PathBuf {
    let mut name = path.file_name().unwrap_or_default().to_os_string();
    name.push(".corrupt");
    path.with_file_name(name)
}

#[cfg(test)]
#[path = "fs_tests.rs"]
mod tests;
