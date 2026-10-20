use std::path::Path;

use anyhow::{Context, Result};
use sha2::{Digest, Sha256};

/// SHA-256 of the running executable as lowercase hex.
pub fn running_binary_sha256() -> Result<String> {
    let path = std::env::current_exe().context("Failed to get current executable path")?;
    file_sha256(&path)
}

pub fn file_sha256(path: &Path) -> Result<String> {
    let mut file =
        std::fs::File::open(path).with_context(|| format!("Failed to open {}", path.display()))?;
    let mut hasher = Sha256::new();
    std::io::copy(&mut file, &mut hasher)
        .with_context(|| format!("Failed to read {}", path.display()))?;
    Ok(format!("{:x}", hasher.finalize()))
}

#[cfg(test)]
#[path = "binary_hash_tests.rs"]
mod tests;
