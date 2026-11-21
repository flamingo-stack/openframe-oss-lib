use serde::Deserialize;
use std::path::Path;

use super::decide::is_under;
use super::windows_app::{identity, Package, Shortcut, SCRIPT_HELPERS, SCRIPT_OUTPUT};
use super::{AppIdentity, Undetermined, RESOLVE_TIMEOUT_SECS};
use crate::executor::{execute_script, Privilege, ScriptParams};
use crate::services::package_manager::choco::{root, SCRIPT_PRELUDE};

const BODY: &str = r#"$chocoRoot = $args[0]
$lib = Join-Path $chocoRoot 'lib'

function Get-ChocoPackage($id) {
    $nuspec = Join-Path $lib "$id\$id.nuspec"
    if (-not (Test-Path -LiteralPath $nuspec)) { return $null }
    $metadata = ([xml](Get-Content -LiteralPath $nuspec -Raw)).package.metadata
    $state = Join-Path $chocoRoot ".chocolatey\$id.$($metadata.version)"
    $deployment = ''
    $file = Join-Path $state '.deploymentLocation'
    if (Test-Path -LiteralPath $file) { $deployment = (Get-Content -LiteralPath $file -Raw).Trim() }
    $codes = @()
    $file = Join-Path $state '.registry'
    if (Test-Path -LiteralPath $file) {
        $codes = @(([xml](Get-Content -LiteralPath $file -Raw)).registrySnapshot.keys.key |
            ForEach-Object { ([string]$_.KeyPath -split '\\')[-1] } | Where-Object { $_ })
    }
    $dependencies = @(@($metadata.dependencies.dependency) + @($metadata.dependencies.group.dependency) |
        Where-Object { $_ } | ForEach-Object { [string]$_.id })
    [pscustomobject]@{ deployment = $deployment; codes = $codes; dependencies = $dependencies }
}

$id = $args[1]
$main = Get-ChocoPackage $id
if (-not $main) {
    $packages = @(@{ id = $id; installed = $false })
} else {
    $parts = @($main) + @($main.dependencies | ForEach-Object { Get-ChocoPackage $_ } | Where-Object { $_ })
    $codes = @($parts | ForEach-Object { $_.codes } | Where-Object { $_ })
    $msiShortcuts = Get-MsiShortcutTargets $codes
    $packages = @(@{
        id = $id
        installed = $true
        lib = $lib
        deployments = @($parts | ForEach-Object { $_.deployment } | Where-Object { $_ })
        hasRegistry = $codes.Count -gt 0
        uninstallCommand = Get-ArpValue $codes 'UninstallString'
        arpInstallLocation = Get-ArpValue $codes 'InstallLocation'
        arpDisplayIcon = Get-ArpValue $codes 'DisplayIcon'
        msiShortcutTargets = @($msiShortcuts.targets)
        msiShortcutErrors = @($msiShortcuts.errors)
    })
}
"#;

#[derive(Debug, Deserialize)]
struct Output {
    shortcuts: Vec<Shortcut>,
    packages: Vec<Found>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Found {
    id: String,
    installed: bool,
    #[serde(default)]
    lib: String,
    #[serde(default)]
    deployments: Vec<String>,
    #[serde(default)]
    has_registry: bool,
    #[serde(default)]
    uninstall_command: Option<String>,
    #[serde(default)]
    arp_install_location: Option<String>,
    #[serde(default)]
    arp_display_icon: Option<String>,
    #[serde(default)]
    msi_shortcut_targets: Vec<String>,
    #[serde(default)]
    msi_shortcut_errors: Vec<String>,
}

pub(super) async fn resolve(id: &str) -> Result<AppIdentity, Undetermined> {
    let result = execute_script(ScriptParams {
        code: &format!("{SCRIPT_PRELUDE}{SCRIPT_HELPERS}{BODY}{SCRIPT_OUTPUT}"),
        shell: "powershell",
        args: &[root(), id.to_string()],
        timeout_secs: RESOLVE_TIMEOUT_SECS,
        privilege: Privilege::Agent,
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
    let output: Output = serde_json::from_str(result.stdout.trim())
        .map_err(|e| Undetermined::Resolver(format!("unparseable output: {e}")))?;
    let found = output
        .packages
        .into_iter()
        .find(|found| found.id.eq_ignore_ascii_case(id))
        .ok_or(Undetermined::NotInstalled)?;
    identity(&package(found), &output.shortcuts)
}

fn package(found: Found) -> Package {
    let lib = Path::new(&found.lib);
    let installed_location = found
        .deployments
        .iter()
        .find(|dir| !is_under(Path::new(dir), lib))
        .or_else(|| {
            if found.has_registry {
                None
            } else {
                found.deployments.first()
            }
        })
        .cloned();
    Package {
        id: found.id,
        installed: found.installed,
        installed_location,
        uninstall_command: found.uninstall_command,
        arp_install_location: found.arp_install_location,
        arp_display_icon: found.arp_display_icon,
        appx_applications: Vec::new(),
        msi_shortcut_targets: found.msi_shortcut_targets,
        msi_shortcut_errors: found.msi_shortcut_errors,
    }
}

#[cfg(test)]
#[path = "choco_tests.rs"]
mod tests;
