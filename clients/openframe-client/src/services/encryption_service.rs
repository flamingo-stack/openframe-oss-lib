// aes-gcm 0.10 re-exports the deprecated generic-array 0.x; silence until the dep is bumped.
#![allow(deprecated)]

use aes_gcm::{
    aead::{generic_array::GenericArray, rand_core::RngCore, Aead, KeyInit, OsRng},
    Aes256Gcm,
};
use anyhow::Result;
use base64::{engine::general_purpose, Engine as _};
use keyring::Entry;

const KEYRING_SERVICE: &str = "openframe-client";
const KEYRING_USERNAME: &str = "encryption-key";

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
    pub fn new() -> Self {
        let key = Self::load_or_generate_key().unwrap_or_else(|_| {
            // Fall back to an in-memory random key if secure storage is unavailable,
            // so encryption still uses a per-instance random key rather than a
            // hardcoded constant.
            let mut fallback = [0u8; 32];
            OsRng.fill_bytes(&mut fallback);
            fallback
        });
        Self { key }
    }

    fn load_or_generate_key() -> Result<[u8; 32]> {
        let entry = Entry::new(KEYRING_SERVICE, KEYRING_USERNAME)
            .map_err(|e| anyhow::anyhow!("Failed to access keyring entry: {}", e))?;

        match entry.get_password() {
            Ok(existing) => {
                let decoded = general_purpose::STANDARD
                    .decode(existing)
                    .map_err(|e| anyhow::anyhow!("Failed to decode stored key: {}", e))?;
                if decoded.len() != 32 {
                    return Err(anyhow::anyhow!("Stored key has invalid length"));
                }
                let mut key = [0u8; 32];
                key.copy_from_slice(&decoded);
                Ok(key)
            }
            Err(_) => {
                let mut key = [0u8; 32];
                OsRng.fill_bytes(&mut key);
                let encoded = general_purpose::STANDARD.encode(key);
                entry
                    .set_password(&encoded)
                    .map_err(|e| anyhow::anyhow!("Failed to store generated key: {}", e))?;
                Ok(key)
            }
        }
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
