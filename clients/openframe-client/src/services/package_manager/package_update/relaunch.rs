use std::ffi::OsStr;
use std::path::{Path, PathBuf};

use tracing::{info, warn};

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
            Some(target) => relaunched |= launch(&target).await,
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

fn find_named(dir: &Path, name: &OsStr, depth: usize) -> Option<PathBuf> {
    let entries = std::fs::read_dir(dir).ok()?;
    let mut subdirs = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file()
            && path
                .file_name()
                .is_some_and(|n| n.eq_ignore_ascii_case(name))
        {
            return Some(path);
        }
        if depth > 0 && path.is_dir() {
            subdirs.push(path);
        }
    }
    subdirs
        .into_iter()
        .find_map(|subdir| find_named(&subdir, name, depth - 1))
}

#[cfg(target_os = "macos")]
async fn launch(image: &Path) -> bool {
    use crate::platform::user_session::{get_console_user, launch_as_user};

    let Some(user) = get_console_user() else {
        warn!(image = %image.display(), "No console user to relaunch the app for");
        return false;
    };
    let bundle = image
        .ancestors()
        .find(|path| path.extension().is_some_and(|ext| ext == "app"));
    let (executable, args) = match bundle {
        Some(bundle) => (
            "/usr/bin/open".to_string(),
            vec![bundle.to_string_lossy().into_owned()],
        ),
        None => (image.to_string_lossy().into_owned(), Vec::new()),
    };
    match launch_as_user(&executable, &args, &user).await {
        Ok(_child) => {
            info!(image = %image.display(), "Relaunched the app after its forced upgrade");
            true
        }
        Err(e) => {
            warn!(image = %image.display(), "Could not relaunch the app: {:#}", e);
            false
        }
    }
}

#[cfg(target_os = "windows")]
async fn launch(image: &Path) -> bool {
    use crate::platform::user_session::launch_in_user_session;

    match launch_in_user_session(&image.to_string_lossy(), &[]) {
        Ok(pid) => {
            info!(image = %image.display(), pid, "Relaunched the app after its forced upgrade");
            true
        }
        Err(e) => {
            warn!(image = %image.display(), "Could not relaunch the app: {:#}", e);
            false
        }
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
async fn launch(image: &Path) -> bool {
    warn!(image = %image.display(), "Relaunching apps is not supported here");
    false
}

#[cfg(test)]
#[path = "relaunch_tests.rs"]
mod tests;
