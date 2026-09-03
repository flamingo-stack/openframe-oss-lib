use anyhow::{Context, Result};

/// Runs filesystem work (multi-megabyte copies, retrying renames, archive
/// extraction) on the blocking pool so it never stalls a tokio worker.
pub async fn run_blocking<T, F>(f: F) -> Result<T>
where
    F: FnOnce() -> Result<T> + Send + 'static,
    T: Send + 'static,
{
    tokio::task::spawn_blocking(f)
        .await
        .context("Blocking task failed to join")?
}
