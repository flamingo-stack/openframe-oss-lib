use std::path::{Path, PathBuf};
use std::time::Duration;

use anyhow::{bail, Context};
use tracing::info;

pub(super) const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Guards the PowerShell signature probe against hanging.
const SIGNATURE_TIMEOUT: Duration = Duration::from_secs(60);

/// Downloads a Microsoft-signed installer into the secured dir and returns its path.
pub(super) async fn microsoft_installer(
    url: &str,
    prefix: &str,
    what: &str,
    max_bytes: u64,
    timeout: Duration,
) -> anyhow::Result<PathBuf> {
    // Staged under the admin-owned secured dir with an unguessable name; the signature check below guards what we execute.
    let path = crate::platform::DirectoryManager::new()
        .secured_dir()
        .join(format!("{}-{}.exe", prefix, uuid::Uuid::new_v4()));
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .with_context(|| format!("Failed to create {}", parent.display()))?;
    }

    info!("Downloading {} from {}", what, url);
    if let Err(e) = download(url, &path, what, max_bytes, timeout).await {
        let _ = tokio::fs::remove_file(&path).await;
        return Err(e);
    }

    if let Err(e) = verify_microsoft_signature(&path, what).await {
        let _ = tokio::fs::remove_file(&path).await;
        return Err(e);
    }
    Ok(path)
}

pub(super) fn staged_running(prefix: &str) -> bool {
    let dir_manager = crate::platform::DirectoryManager::new();
    crate::platform::process_snapshot::snapshot()
        .iter()
        .any(|process| is_staged(&process.image, dir_manager.secured_dir(), prefix))
}

pub(super) fn staged(prefixes: &[&str]) -> Vec<PathBuf> {
    let dir_manager = crate::platform::DirectoryManager::new();
    let secured = dir_manager.secured_dir();
    let Ok(entries) = std::fs::read_dir(secured) else {
        return Vec::new();
    };
    entries
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| {
            prefixes
                .iter()
                .any(|prefix| is_staged(path, secured, prefix))
        })
        .collect()
}

fn is_staged(path: &Path, secured: &Path, prefix: &str) -> bool {
    let in_secured = path
        .parent()
        .is_some_and(|parent| parent.as_os_str().eq_ignore_ascii_case(secured.as_os_str()));
    let named = path
        .file_name()
        .and_then(|name| name.to_str())
        .map(str::to_ascii_lowercase)
        .is_some_and(|name| {
            name.starts_with(&format!("{}-", prefix.to_ascii_lowercase())) && name.ends_with(".exe")
        });
    in_secured && named
}

/// Streams the download to disk, capped so an oversized response cannot exhaust agent memory.
async fn download(
    url: &str,
    path: &Path,
    what: &str,
    max_bytes: u64,
    timeout: Duration,
) -> anyhow::Result<()> {
    use tokio::io::AsyncWriteExt;

    let mut response = reqwest::Client::builder()
        .timeout(timeout)
        .build()
        .context("Failed to create HTTP client")?
        .get(url)
        .send()
        .await
        .with_context(|| format!("Failed to download {}", what))?
        .error_for_status()
        .with_context(|| format!("{} download failed", what))?;

    let mut file = tokio::fs::File::create(path)
        .await
        .with_context(|| format!("Failed to create {}", path.display()))?;
    let mut written: u64 = 0;
    while let Some(chunk) = response
        .chunk()
        .await
        .with_context(|| format!("Failed to read {} body", what))?
    {
        written += chunk.len() as u64;
        if written > max_bytes {
            bail!(
                "{} download exceeded {} MB",
                what,
                max_bytes / (1024 * 1024)
            );
        }
        file.write_all(&chunk)
            .await
            .with_context(|| format!("Failed to write {}", path.display()))?;
    }
    file.flush()
        .await
        .with_context(|| format!("Failed to flush {}", path.display()))
}

/// PowerShell probe: exits 0 only for a valid Microsoft Authenticode signature; `{path}` is filled in at run time.
const SIGNATURE_CHECK_SCRIPT: &str =
    "$s = Get-AuthenticodeSignature -LiteralPath '{path}'; \
     if ($s.Status -eq 'Valid' -and $s.SignerCertificate.Subject -like '*O=Microsoft Corporation*') { exit 0 }; \
     Write-Output \"status=$($s.Status) subject=$($s.SignerCertificate.Subject)\"; exit 1";

/// Rejects the download unless it carries a valid Microsoft Authenticode signature.
async fn verify_microsoft_signature(path: &Path, what: &str) -> anyhow::Result<()> {
    let powershell = crate::platform::get_powershell_path();
    let script = SIGNATURE_CHECK_SCRIPT.replace("{path}", &path.display().to_string());

    let output = tokio::time::timeout(
        SIGNATURE_TIMEOUT,
        tokio::process::Command::new(powershell)
            .args(["-NoProfile", "-NonInteractive", "-Command", &script])
            .creation_flags(CREATE_NO_WINDOW)
            .kill_on_drop(true)
            .output(),
    )
    .await
    .context("Authenticode verification timed out")?
    .context("Failed to run Authenticode verification")?;

    if !output.status.success() {
        bail!(
            "{} failed Authenticode verification: {}",
            what,
            String::from_utf8_lossy(&output.stdout).trim()
        );
    }
    Ok(())
}

#[cfg(test)]
#[path = "download_tests.rs"]
mod tests;
