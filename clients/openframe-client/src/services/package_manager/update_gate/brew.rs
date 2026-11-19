use super::{AppIdentity, MainImages, Undetermined, RESOLVE_TIMEOUT_SECS};
use crate::executor::{execute_script, Privilege, ScriptParams};
use crate::services::package_manager::brew::{
    self, Cask, CaskApp, CaskInfo, APPLICATIONS, CASK_INFO,
};
use std::path::Path;

/// Where brew installed the cask's app.
pub(super) async fn resolve(name: &str) -> Result<AppIdentity, Undetermined> {
    let info = run(&[name.to_string()]).await?;
    info.casks
        .iter()
        .find(|cask| cask.is_named(name))
        .map_or(Err(Undetermined::NotInstalled), |cask| {
            identity(cask, Path::new(APPLICATIONS))
        })
}

async fn run(names: &[String]) -> Result<CaskInfo, Undetermined> {
    let result = execute_script(ScriptParams {
        code: &brew::script(CASK_INFO),
        shell: "bash",
        args: names,
        timeout_secs: RESOLVE_TIMEOUT_SECS,
        privilege: Privilege::User,
        env_vars: &[],
    })
    .await;
    if result.retcode != 0 {
        return Err(Undetermined::Resolver(format!(
            "exit {}: {}",
            result.retcode,
            result.stderr.trim()
        )));
    }
    CaskInfo::from_output(&result.stdout)
        .map_err(|e| Undetermined::Resolver(format!("unparseable output: {e}")))
}

/// The cask's app bundle and main images; NoApp for file-only casks, pkg and script casks unknown.
fn identity(cask: &Cask, applications: &Path) -> Result<AppIdentity, Undetermined> {
    if cask.installed.is_none() {
        return Err(Undetermined::NotInstalled);
    }
    let install_dir = match cask.app(applications) {
        CaskApp::Bundle(install_dir) => install_dir,
        CaskApp::NoApp => return Ok(AppIdentity::NoApp),
        CaskApp::Unknown => return Err(Undetermined::NoInstallLocation),
    };

    // Main images sit directly in Contents/MacOS; nested helper bundles never match.
    let mut names: Vec<String> = std::fs::read_dir(install_dir.join("Contents").join("MacOS"))
        .map(|entries| {
            entries
                .flatten()
                .filter(|entry| entry.file_type().is_ok_and(|t| t.is_file()))
                .map(|entry| entry.file_name().to_string_lossy().into_owned())
                .collect()
        })
        .unwrap_or_default();
    names.sort();

    let main_images = if names.is_empty() {
        MainImages::Unknown
    } else {
        MainImages::Derived(names)
    };
    Ok(AppIdentity::App {
        install_dir,
        main_images,
    })
}

#[cfg(test)]
#[path = "brew_tests.rs"]
mod tests;
