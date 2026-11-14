use super::windows_app::{identity, Output, SCRIPT_HELPERS, SCRIPT_OUTPUT};
use super::{AppIdentity, Undetermined, RESOLVE_TIMEOUT_SECS};
use crate::executor::{execute_script, Privilege, ScriptParams};

/// Emits raw facts only; every choice is made in Rust. Runs as the console user.
const PRELUDE: &str = r#"$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Import-Module Microsoft.WinGet.Client

$flags = [Reflection.BindingFlags]'Instance,NonPublic,Public'
"#;

const BODY: &str = r#"$rows = @(Get-WinGetPackage)
$packages = @(
    foreach ($id in $args) {
        $row = $rows | Where-Object { $_.Id -eq $id } | Select-Object -First 1
        if (-not $row) { @{ id = $id; installed = $false }; continue }
        $version = $row.GetType().GetProperty('CatalogPackageCOM', $flags).GetValue($row).InstalledVersion
        $field = $version.GetType().Assembly.GetType('Microsoft.Management.Deployment.PackageVersionMetadataField')
        $location = [string]$version.GetMetadata([Enum]::Parse($field, 'InstalledLocation'))
        $codes = @($version.ProductCodes)
        $applications = @()
        if (@($version.PackageFamilyNames).Count -gt 0 -and $location) {
            $manifest = Join-Path $location 'AppxManifest.xml'
            if (Test-Path -LiteralPath $manifest) {
                $applications = @(([xml](Get-Content -LiteralPath $manifest -Raw)).Package.Applications.Application |
                    Where-Object { $_.Executable } |
                    ForEach-Object { @{ executable = [string]$_.Executable; appListEntry = [string]$_.VisualElements.AppListEntry } })
            }
        }
        $msiShortcuts = Get-MsiShortcutTargets $codes
        @{
            id = $id
            installed = $true
            installedLocation = $location
            uninstallCommand = [string]$version.GetMetadata([Enum]::Parse($field, 'StandardUninstallCommand'))
            arpInstallLocation = Get-ArpValue $codes 'InstallLocation'
            arpDisplayIcon = Get-ArpValue $codes 'DisplayIcon'
            msiShortcutTargets = @($msiShortcuts.targets)
            msiShortcutErrors = @($msiShortcuts.errors)
            appxApplications = $applications
        }
    }
)

"#;

pub(super) async fn resolve(id: &str) -> Result<AppIdentity, Undetermined> {
    let output = run(&[id.to_string()]).await?;
    output
        .packages
        .iter()
        .find(|package| package.id == id)
        .map_or(Err(Undetermined::NotInstalled), |package| {
            identity(package, &output.shortcuts)
        })
}

async fn run(ids: &[String]) -> Result<Output, Undetermined> {
    let result = execute_script(ScriptParams {
        code: &format!("{PRELUDE}{SCRIPT_HELPERS}{BODY}{SCRIPT_OUTPUT}"),
        shell: "powershell",
        args: ids,
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
    serde_json::from_str(result.stdout.trim())
        .map_err(|e| Undetermined::Resolver(format!("unparseable output: {e}")))
}
