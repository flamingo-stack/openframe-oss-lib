use anyhow::{anyhow, Context, Result};
use bytes::Bytes;
use reqwest::Client;
use std::io::Cursor;
use tokio::time::{Duration, Instant};
use tracing::{info, warn};

use crate::config::updater_config::{
    DOWNLOAD_TIMEOUT_SECS, DOWNLOAD_TOTAL_BUDGET_SECS, MAX_DOWNLOAD_RETRIES, MIN_BINARY_SIZE_BYTES,
};
use crate::models::DownloadConfiguration;

#[derive(Clone)]
pub struct GithubDownloadService {
    http_client: Client,
}

impl GithubDownloadService {
    pub fn new(http_client: Client) -> Self {
        Self { http_client }
    }

    /// Downloads the archive for `config` and extracts the client binary from it.
    /// Returns raw binary bytes ready to be written to disk.
    pub async fn download_and_extract(&self, config: &DownloadConfiguration) -> Result<Bytes> {
        info!("Downloading from: {}", config.link);

        let archive_bytes = self
            .download_with_retry(&config.link)
            .await
            .with_context(|| format!("Failed to download from: {}", config.link))?;

        info!("Downloaded {} bytes", archive_bytes.len());

        if archive_bytes.len() < MIN_BINARY_SIZE_BYTES as usize {
            return Err(anyhow!(
                "Downloaded archive too small ({} bytes, minimum {})",
                archive_bytes.len(),
                MIN_BINARY_SIZE_BYTES
            ));
        }

        let is_zip = config.file_name.ends_with(".zip");
        let is_tar_gz = config.file_name.ends_with(".tar.gz") || config.file_name.ends_with(".tgz");
        if !is_zip && !is_tar_gz {
            return Err(anyhow!("Unsupported archive format: {}", config.file_name));
        }

        let service = self.clone();
        let target_file_name = config.target_file_name.clone();
        let binary_bytes = tokio::task::spawn_blocking(move || {
            if is_zip {
                info!("Extracting from ZIP: target={}", target_file_name);
                service
                    .extract_from_zip(archive_bytes, &target_file_name)
                    .context("Failed to extract from ZIP archive")
            } else {
                info!("Extracting from tar.gz: target={}", target_file_name);
                service
                    .extract_from_tar_gz(archive_bytes, &target_file_name)
                    .context("Failed to extract from tar.gz archive")
            }
        })
        .await
        .context("Archive extraction task failed to join")??;

        if binary_bytes.len() < MIN_BINARY_SIZE_BYTES as usize {
            return Err(anyhow!(
                "Extracted binary too small ({} bytes, minimum {})",
                binary_bytes.len(),
                MIN_BINARY_SIZE_BYTES
            ));
        }

        info!(
            "Extracted binary: {} ({} bytes)",
            config.target_file_name,
            binary_bytes.len()
        );
        Ok(binary_bytes)
    }

    /// Returns the `DownloadConfiguration` matching the current OS.
    pub fn find_for_current_os<'a>(
        &self,
        configs: &'a [DownloadConfiguration],
    ) -> Result<&'a DownloadConfiguration> {
        configs
            .iter()
            .find(|c| c.matches_current_os())
            .ok_or_else(|| anyhow!("No download configuration for current OS"))
    }

    // ── internals ──────────────────────────────────────────────────────────

    async fn download_with_retry(&self, url: &str) -> Result<Bytes> {
        let mut last_error = None;
        let deadline = Instant::now() + Duration::from_secs(DOWNLOAD_TOTAL_BUDGET_SECS);
        let attempt_timeout = |deadline: Instant| {
            deadline
                .saturating_duration_since(Instant::now())
                .min(Duration::from_secs(DOWNLOAD_TIMEOUT_SECS))
        };

        for attempt in 1..=MAX_DOWNLOAD_RETRIES {
            let timeout = attempt_timeout(deadline);
            if timeout.is_zero() {
                warn!(
                    "Download budget of {}s exhausted before attempt {}",
                    DOWNLOAD_TOTAL_BUDGET_SECS, attempt
                );
                break;
            }
            info!(
                "Download attempt {}/{} ({}s budget left): {}",
                attempt,
                MAX_DOWNLOAD_RETRIES,
                timeout.as_secs(),
                url
            );

            match tokio::time::timeout(timeout, self.download(url)).await {
                Ok(Ok(bytes)) => {
                    info!("Download succeeded on attempt {}", attempt);
                    return Ok(bytes);
                }
                Ok(Err(e)) => {
                    if e.to_string().contains("429") {
                        warn!("GitHub rate limit (429) — trying jsDelivr CDN fallback");
                        let cdn_url = Self::github_to_cdn_url(url);
                        info!("CDN URL: {}", cdn_url);

                        match tokio::time::timeout(
                            attempt_timeout(deadline),
                            self.download(&cdn_url),
                        )
                        .await
                        {
                            Ok(Ok(bytes)) => {
                                info!("Downloaded from jsDelivr CDN");
                                return Ok(bytes);
                            }
                            Ok(Err(cdn_err)) => {
                                return Err(anyhow!(
                                    "GitHub rate limited and CDN also failed. GitHub: {:#} CDN: {:#}",
                                    e, cdn_err
                                ));
                            }
                            Err(_) => {
                                return Err(anyhow!("GitHub rate limited and CDN timed out"));
                            }
                        }
                    }
                    warn!("Attempt {} failed: {:#}", attempt, e);
                    last_error = Some(e);
                }
                Err(_) => {
                    warn!("Attempt {} timed out after {}s", attempt, timeout.as_secs());
                    last_error = Some(anyhow!("Timeout after {}s", timeout.as_secs()));
                }
            }

            if attempt < MAX_DOWNLOAD_RETRIES {
                let delay = Duration::from_secs((attempt * 2) as u64);
                if Instant::now() + delay >= deadline {
                    warn!(
                        "Download budget of {}s exhausted after attempt {}",
                        DOWNLOAD_TOTAL_BUDGET_SECS, attempt
                    );
                    break;
                }
                info!("Retrying in {}s", delay.as_secs());
                tokio::time::sleep(delay).await;
            }
        }

        Err(last_error.unwrap_or_else(|| {
            anyhow!(
                "Download failed within the {}s budget",
                DOWNLOAD_TOTAL_BUDGET_SECS
            )
        }))
    }

    async fn download(&self, url: &str) -> Result<Bytes> {
        let response = self
            .http_client
            .get(url)
            .send()
            .await
            .context("Failed to send request")?;

        if !response.status().is_success() {
            return Err(anyhow!("HTTP {} — {}", response.status(), url));
        }

        response
            .bytes()
            .await
            .context("Failed to read response bytes")
    }

    fn github_to_cdn_url(github_url: &str) -> String {
        github_url
            .replace("github.com/", "cdn.jsdelivr.net/gh/")
            .replace("/releases/download/", "@")
    }

    #[cfg(target_os = "windows")]
    fn extract_from_zip(&self, archive_bytes: Bytes, target_filename: &str) -> Result<Bytes> {
        use zip::ZipArchive;

        let cursor = Cursor::new(archive_bytes);
        let mut archive = ZipArchive::new(cursor).context("Failed to open ZIP")?;

        for i in 0..archive.len() {
            let mut entry = archive.by_index(i).context("Failed to read ZIP entry")?;
            let name = entry.name().to_string();

            if name
                .to_lowercase()
                .ends_with(&target_filename.to_lowercase())
            {
                info!("Found in ZIP: {}", name);
                let mut buf = Vec::new();
                std::io::copy(&mut entry, &mut buf).context("Failed to read ZIP entry bytes")?;
                return Ok(Bytes::from(buf));
            }
        }

        Err(anyhow!("'{}' not found in ZIP", target_filename))
    }

    #[cfg(not(target_os = "windows"))]
    fn extract_from_zip(&self, _bytes: Bytes, target: &str) -> Result<Bytes> {
        Err(anyhow!(
            "ZIP extraction not supported on this platform for '{}'",
            target
        ))
    }

    #[cfg(not(target_os = "windows"))]
    fn extract_from_tar_gz(&self, archive_bytes: Bytes, target_filename: &str) -> Result<Bytes> {
        use flate2::read::GzDecoder;
        use tar::Archive;

        let cursor = Cursor::new(archive_bytes);
        let mut archive = Archive::new(GzDecoder::new(cursor));

        for entry_result in archive.entries().context("Failed to read tar entries")? {
            let mut entry = entry_result.context("Failed to read tar entry")?;
            let path = entry.path().context("Failed to get entry path")?;

            let basename = path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            if basename.eq_ignore_ascii_case(target_filename) && !basename.starts_with("._") {
                info!("Found in tar.gz: {}", path.display());
                let mut buf = Vec::new();
                std::io::copy(&mut entry, &mut buf).context("Failed to read tar entry bytes")?;
                return Ok(Bytes::from(buf));
            }
        }

        Err(anyhow!("'{}' not found in tar.gz", target_filename))
    }

    #[cfg(target_os = "windows")]
    fn extract_from_tar_gz(&self, _bytes: Bytes, target: &str) -> Result<Bytes> {
        Err(anyhow!(
            "tar.gz extraction not supported on Windows for '{}'",
            target
        ))
    }
}

#[cfg(test)]
#[path = "github_download_service_tests.rs"]
mod tests;
