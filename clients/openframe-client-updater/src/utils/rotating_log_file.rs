use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::PathBuf;

use crate::config::updater_config::{UPDATER_LOG_KEEP_ROTATED, UPDATER_LOG_MAX_BYTES};

/// Append-only log file that rotates itself in place: once it exceeds
/// UPDATER_LOG_MAX_BYTES it is renamed to `.log.1` (older copies shift up to
/// UPDATER_LOG_KEEP_ROTATED) and a fresh file is opened at the same path, so
/// openframe-client keeps tailing a fixed name.
pub struct RotatingLogFile {
    path: PathBuf,
    file: Option<File>,
    written: u64,
    max_bytes: u64,
    next_rotation_at: u64,
}

impl RotatingLogFile {
    pub fn open(path: PathBuf) -> io::Result<Self> {
        Self::with_limit(path, UPDATER_LOG_MAX_BYTES)
    }

    pub fn with_limit(path: PathBuf, max_bytes: u64) -> io::Result<Self> {
        let file = Self::open_append(&path)?;
        let written = file.metadata()?.len();
        Ok(Self {
            path,
            file: Some(file),
            written,
            max_bytes,
            next_rotation_at: max_bytes,
        })
    }

    fn open_append(path: &PathBuf) -> io::Result<File> {
        OpenOptions::new().create(true).append(true).open(path)
    }

    fn rotated_path(&self, index: usize) -> PathBuf {
        PathBuf::from(format!("{}.{}", self.path.display(), index))
    }

    fn rotate(&mut self) -> io::Result<()> {
        self.file = None;
        let _ = fs::remove_file(self.rotated_path(UPDATER_LOG_KEEP_ROTATED));
        for index in (1..UPDATER_LOG_KEEP_ROTATED).rev() {
            let from = self.rotated_path(index);
            if from.exists() {
                let _ = fs::rename(&from, self.rotated_path(index + 1));
            }
        }
        let result = fs::rename(&self.path, self.rotated_path(1));
        self.file = Some(Self::open_append(&self.path)?);
        result?;
        self.written = 0;
        self.next_rotation_at = self.max_bytes;
        Ok(())
    }
}

impl Write for RotatingLogFile {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        if self.written >= self.next_rotation_at {
            if let Err(e) = self.rotate() {
                eprintln!("Failed to rotate log file {}: {}", self.path.display(), e);
                self.next_rotation_at = self.written + self.max_bytes;
            }
        }
        if self.file.is_none() {
            self.file = Some(Self::open_append(&self.path)?);
        }
        let n = self.file.as_mut().expect("log file open").write(buf)?;
        self.written += n as u64;
        Ok(n)
    }

    fn flush(&mut self) -> io::Result<()> {
        match self.file.as_mut() {
            Some(file) => file.flush(),
            None => Ok(()),
        }
    }
}

#[cfg(test)]
#[path = "rotating_log_file_tests.rs"]
mod tests;
