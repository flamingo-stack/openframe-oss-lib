use anyhow::{Context, Result};
use std::fs;
use std::io::Write;
use std::path::Path;

/// Writes `bytes` through a synced temp sibling and a rename, then syncs the
/// directory: after a power cut the file holds either the old or the new content.
pub fn write_durably(path: &Path, bytes: &[u8]) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("Failed to create dir {}", parent.display()))?;
    }

    let mut temp_path = path.as_os_str().to_owned();
    temp_path.push(".tmp");
    let temp_path = Path::new(&temp_path);
    {
        let mut file = fs::File::create(temp_path)
            .with_context(|| format!("Failed to create {}", temp_path.display()))?;
        file.write_all(bytes)
            .with_context(|| format!("Failed to write {}", temp_path.display()))?;
        file.sync_all()
            .with_context(|| format!("Failed to sync {}", temp_path.display()))?;
    }
    fs::rename(temp_path, path)
        .with_context(|| format!("Failed to move {} into place", path.display()))?;
    sync_parent_dir(path)
}

/// Makes a rename or removal in `path`'s directory durable (a no-op on Windows,
/// where NTFS journals the rename).
#[cfg(unix)]
pub fn sync_parent_dir(path: &Path) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::File::open(parent)
            .and_then(|dir| dir.sync_all())
            .with_context(|| format!("Failed to sync directory {}", parent.display()))?;
    }
    Ok(())
}

#[cfg(not(unix))]
pub fn sync_parent_dir(_path: &Path) -> Result<()> {
    Ok(())
}
