// aes-gcm 0.10 re-exports the deprecated generic-array 0.x; silence until the dep is bumped.
#![allow(deprecated)]

use aes_gcm::{
    aead::{generic_array::GenericArray, rand_core::RngCore, Aead, KeyInit, OsRng},
    Aes256Gcm,
};
use anyhow::Result;
use base64::{engine::general_purpose, Engine as _};
use std::fs;
use std::path::PathBuf;

#[derive(Clone)]
pub struct EncryptionService {
    key: [u8; 32],
}

impl Default for EncryptionService {
    fn default() -> Self {
        Self::new()
    }
}

impl EncryptionService {
    fn key_file_path() -> Result<PathBuf> {
        let mut dir = dirs::data_local_dir()
            .or_else(dirs::config_dir)
            .ok_or_else(|| anyhow::anyhow!("Failed to determine local data directory for key storage"))?;
        dir.push("openframe-client");
        fs::create_dir_all(&dir)
            .map_err(|e| anyhow::anyhow!("Failed to create key storage directory: {}", e))?;
        dir.push("encryption.key");
        Ok(dir)
    }

    fn load_or_generate_key() -> Result<[u8; 32]> {
        let path = Self::key_file_path()?;

        if let Ok(existing) = fs::read(&path) {
            if existing.len() == 32 {
                let mut key = [0u8; 32];
                key.copy_from_slice(&existing);
                return Ok(key);
            }
        }

        let mut key = [0u8; 32];
        OsRng.fill_bytes(&mut key);

        fs::write(&path, key)
            .map_err(|e| anyhow::anyhow!("Failed to persist generated encryption key: {}", e))?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Ok(metadata) = fs::metadata(&path) {
                let mut permissions = metadata.permissions();
                permissions.set_mode(0o600);
                let _ = fs::set_permissions(&path, permissions);
            }
        }

        Ok(key)
    }

    pub fn new() -> Self {
        let key = Self::load_or_generate_key()
            .expect("Failed to load or generate per-install encryption key");
        Self { key }
    }

    pub fn encrypt(&self, data: &str) -> Result<String> {
        let key = Aes256Gcm::new_from_slice(&self.key)
            .map_err(|e| anyhow::anyhow!("Failed to create encryption key: {}", e))?;

        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = GenericArray::from_slice(&nonce_bytes);

        let ciphertext = key
            .encrypt(nonce, data.as_bytes())
            .map_err(|e| anyhow::anyhow!("Failed to encrypt data: {}", e))?;

        let mut combined = nonce_bytes.to_vec();
        combined.extend_from_slice(&ciphertext);

        let base64_encoded = general_purpose::STANDARD.encode(combined);
        Ok(base64_encoded)
    }
}
