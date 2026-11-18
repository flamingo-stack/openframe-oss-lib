// aes-gcm 0.10 re-exports the deprecated generic-array 0.x; silence until the dep is bumped.
#![allow(deprecated)]

use aes_gcm::{
    aead::{generic_array::GenericArray, rand_core::RngCore, Aead, KeyInit, OsRng},
    Aes256Gcm,
};
use anyhow::Result;
use base64::{engine::general_purpose, Engine as _};

// TODO: use generated key
pub const KEY: &str = "12345678901234567890123456789012";
pub const FILE_NAME: &str = "shared_token.enc";

const NONCE_LEN: usize = 12;

pub fn encrypt(key: &[u8], plaintext: &str) -> Result<String> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| anyhow::anyhow!("Failed to create encryption key: {}", e))?;

    let mut nonce_bytes = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = GenericArray::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| anyhow::anyhow!("Failed to encrypt data: {}", e))?;

    let mut combined = nonce_bytes.to_vec();
    combined.extend_from_slice(&ciphertext);

    Ok(general_purpose::STANDARD.encode(combined))
}

pub fn decrypt(key: &[u8], encrypted: &str) -> Result<String> {
    let combined = general_purpose::STANDARD
        .decode(encrypted)
        .map_err(|e| anyhow::anyhow!("Failed to decode base64: {}", e))?;
    anyhow::ensure!(combined.len() >= NONCE_LEN, "Encrypted data too short");

    let (nonce_bytes, ciphertext) = combined.split_at(NONCE_LEN);
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| anyhow::anyhow!("Failed to create cipher: {}", e))?;
    let plaintext = cipher
        .decrypt(GenericArray::from_slice(nonce_bytes), ciphertext)
        .map_err(|e| anyhow::anyhow!("Failed to decrypt: {}", e))?;

    String::from_utf8(plaintext).map_err(|e| anyhow::anyhow!("Failed to convert to UTF-8: {}", e))
}

#[cfg(test)]
#[path = "shared_token_tests.rs"]
mod tests;
