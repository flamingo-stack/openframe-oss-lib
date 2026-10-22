use anyhow::{Context, Result};
use sha2::{Digest, Sha256};
use std::fs::File;
use std::path::Path;
use tracing::{info, warn};

/// Lower-case hex SHA-256 of the executable this process runs from; a failure only logs a warning.
pub fn current_exe_sha256() -> Option<String> {
    let hashed = std::env::current_exe()
        .context("Failed to resolve the running executable")
        .and_then(|path| sha256_file(&path));
    match hashed {
        Ok(hash) => {
            info!("Binary SHA-256: {}", hash);
            Some(hash)
        }
        Err(e) => {
            warn!(
                "Failed to hash the running executable, the x-binary-hash header is omitted: {:#}",
                e
            );
            None
        }
    }
}

pub fn sha256_file(path: &Path) -> Result<String> {
    let mut file =
        File::open(path).with_context(|| format!("Failed to open {}", path.display()))?;
    let mut hasher = Sha256::new();
    std::io::copy(&mut file, &mut hasher)
        .with_context(|| format!("Failed to read {}", path.display()))?;
    Ok(format!("{:x}", hasher.finalize()))
}

#[cfg(test)]
#[path = "binary_hash_tests.rs"]
mod tests;
