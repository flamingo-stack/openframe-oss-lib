use std::ffi::OsStr;
use std::path::{Path, PathBuf};

use tracing::warn;

use crate::platform::app_close;
use crate::services::package_manager::update_gate::{AppIdentity, Holder};

const SEARCH_DEPTH: usize = 3;

/// Relaunches the apps a forced close stopped, as the console user; true when any came back.
pub(super) async fn relaunch(closed: &[Holder], identity: Option<&AppIdentity>) -> bool {
    let mut images: Vec<&PathBuf> = closed.iter().map(|holder| &holder.image).collect();
    images.sort();
    images.dedup();

    let mut relaunched = false;
    for image in images {
        match locate(image, identity) {
            Some(target) => relaunched |= app_close::reopen(&target).await,
            None => {
                warn!(image = %image.display(), "The closed app is gone after the upgrade, not relaunching it")
            }
        }
    }
    relaunched
}

/// The image that was closed, or its replacement when the upgrade moved it (a versioned dir).
fn locate(image: &Path, identity: Option<&AppIdentity>) -> Option<PathBuf> {
    if image.exists() {
        return Some(image.to_path_buf());
    }
    let Some(AppIdentity::App { install_dir, .. }) = identity else {
        return None;
    };
    find_named(install_dir, image.file_name()?, SEARCH_DEPTH)
}

/// Breadth first, so a main executable near the top wins over a helper buried in resources.
fn find_named(dir: &Path, name: &OsStr, depth: usize) -> Option<PathBuf> {
    let mut level = vec![dir.to_path_buf()];
    for _ in 0..=depth {
        let mut next = Vec::new();
        for dir in &level {
            let Ok(entries) = std::fs::read_dir(dir) else {
                continue;
            };
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file()
                    && path
                        .file_name()
                        .is_some_and(|n| n.eq_ignore_ascii_case(name))
                {
                    return Some(path);
                }
                if path.is_dir() {
                    next.push(path);
                }
            }
        }
        level = next;
    }
    None
}

#[cfg(test)]
#[path = "relaunch_tests.rs"]
mod tests;
