use crate::platform::directories::DirectoryManager;
use crate::utils::fs::atomic_write;
use anyhow::Result;
use openframe_common::auth::shared_token;

#[derive(Clone)]
pub struct SharedTokenService {
    dir_manager: DirectoryManager,
}

impl SharedTokenService {
    pub fn new(dir_manager: DirectoryManager) -> Self {
        Self { dir_manager }
    }

    pub fn update(&self, token: String) -> Result<()> {
        let token_file_path = self.dir_manager.secured_dir().join(shared_token::FILE_NAME);
        let encrypted_token = shared_token::encrypt(shared_token::KEY.as_bytes(), &token)?;
        atomic_write(&token_file_path, encrypted_token)?;
        Ok(())
    }
}
