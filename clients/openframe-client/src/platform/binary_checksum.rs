use std::fs::File;
use std::io::{self, Read};
use std::path::Path;

use anyhow::{Context, Result};
use sha2::{Digest, Sha256};
use tracing::{info, warn};

const READ_BUFFER_SIZE: usize = 64 * 1024;

/// SHA-256 of the running executable, which the server compares with the checksums published for this release.
/// Empty when it cannot be computed; the server policy decides what an agent without a checksum may do.
pub async fn current_executable_sha256() -> String {
    let checksum = tokio::task::spawn_blocking(compute_current_executable_sha256)
        .await
        .context("Binary checksum task failed")
        .and_then(|result| result);

    match checksum {
        Ok(checksum) => {
            info!("Running executable sha256: {}", checksum);
            checksum
        }
        Err(e) => {
            warn!("Failed to compute running executable sha256: {:#}", e);
            String::new()
        }
    }
}

fn compute_current_executable_sha256() -> Result<String> {
    let executable = std::env::current_exe().context("Failed to resolve current executable")?;
    file_sha256(&executable).with_context(|| format!("Failed to hash {}", executable.display()))
}

pub(crate) fn file_sha256(path: &Path) -> io::Result<String> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; READ_BUFFER_SIZE];
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(to_hex(&hasher.finalize()))
}

fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{:02x}", byte)).collect()
}

#[cfg(test)]
#[path = "binary_checksum_tests.rs"]
mod tests;
