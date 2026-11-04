use super::decide::is_under;
use super::{AppIdentity, MainImages, Undetermined, RESOLVE_TIMEOUT_SECS};
use crate::executor::{execute_script, Privilege, ScriptParams};
use serde::Deserialize;
use std::path::{Path, PathBuf};

/// Emits raw facts only; every choice is made in Rust. Runs as the console user.
const IDENTITY_SCRIPT: &str = r#"$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Import-Module Microsoft.WinGet.Client

$flags = [Reflection.BindingFlags]'Instance,NonPublic,Public'
$shell = New-Object -ComObject WScript.Shell
$shortcuts = @(
    foreach ($root in "$env:ProgramData\Microsoft\Windows\Start Menu\Programs", "$env:APPDATA\Microsoft\Windows\Start Menu\Programs") {
        if (Test-Path -LiteralPath $root) {
            foreach ($lnk in Get-ChildItem -LiteralPath $root -Recurse -Filter *.lnk -ErrorAction SilentlyContinue) {
                $s = $shell.CreateShortcut($lnk.FullName)
                @{ target = [string]$s.TargetPath; arguments = [string]$s.Arguments }
            }
        }
    }
)

function Get-ArpValue($codes, $name) {
    foreach ($code in $codes) {
        foreach ($root in 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall',
                          'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall',
                          'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall') {
            $value = (Get-ItemProperty -LiteralPath "$root\$code" -Name $name -ErrorAction SilentlyContinue).$name
            if ($value) { return [string]$value }
        }
    }
    return ''
}

$rows = @(Get-WinGetPackage)
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
        @{
            id = $id
            installed = $true
            installedLocation = $location
            uninstallCommand = [string]$version.GetMetadata([Enum]::Parse($field, 'StandardUninstallCommand'))
            arpInstallLocation = Get-ArpValue $codes 'InstallLocation'
            arpDisplayIcon = Get-ArpValue $codes 'DisplayIcon'
            appxApplications = $applications
        }
    }
)

$json = ConvertTo-Json -InputObject @{ shortcuts = $shortcuts; packages = $packages } -Depth 4 -Compress
[regex]::Replace($json, '[^\x00-\x7F]', { param($m) '\u{0:x4}' -f [int][char]$m.Value })
"#;

const BROAD_DIRS: &[&str] = &[
    r"\program files",
    r"\program files (x86)",
    r"\programdata",
    r"\windows",
    r"\windows\system32",
    r"\users",
];

#[derive(Debug, Deserialize)]
struct Output {
    shortcuts: Vec<Shortcut>,
    packages: Vec<Package>,
}

#[derive(Debug, Deserialize)]
struct Shortcut {
    target: String,
    #[serde(default)]
    arguments: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Package {
    id: String,
    installed: bool,
    #[serde(default)]
    installed_location: Option<String>,
    #[serde(default)]
    uninstall_command: Option<String>,
    #[serde(default)]
    arp_install_location: Option<String>,
    #[serde(default)]
    arp_display_icon: Option<String>,
    #[serde(default)]
    appx_applications: Vec<AppxApplication>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppxApplication {
    executable: String,
    /// `none` hides the entry from Start: a helper, not the app.
    #[serde(default)]
    app_list_entry: Option<String>,
}

/// Where the package's app is installed and what it runs as.
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
        code: IDENTITY_SCRIPT,
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

fn identity(package: &Package, shortcuts: &[Shortcut]) -> Result<AppIdentity, Undetermined> {
    if !package.installed {
        return Err(Undetermined::NotInstalled);
    }

    let install_dir = [
        package.installed_location.as_deref().map(PathBuf::from),
        package
            .uninstall_command
            .as_deref()
            .and_then(command_image)
            .and_then(|image| image.parent().map(Path::to_path_buf)),
        package.arp_install_location.as_deref().map(PathBuf::from),
        package
            .arp_display_icon
            .as_deref()
            .and_then(command_image)
            .and_then(|image| image.parent().map(Path::to_path_buf)),
    ]
    .into_iter()
    .flatten()
    .find(|dir| is_app_dir(dir))
    .ok_or(Undetermined::NoInstallLocation)?;

    let mut names: Vec<String> = if package.appx_applications.is_empty() {
        shortcuts
            .iter()
            .filter_map(|shortcut| shortcut_image(shortcut, &install_dir))
            .chain(
                package
                    .arp_display_icon
                    .as_deref()
                    .and_then(command_image)
                    .filter(|image| is_under(image, &install_dir))
                    .and_then(|image| file_name(&image)),
            )
            .collect()
    } else {
        package
            .appx_applications
            .iter()
            .filter(|application| {
                !application
                    .app_list_entry
                    .as_deref()
                    .is_some_and(|entry| entry.eq_ignore_ascii_case("none"))
            })
            .filter_map(|application| file_name(Path::new(&application.executable)))
            .collect()
    };
    names.retain(|name| {
        name != "update.exe"
            && !name.starts_with("unins")
            && !name.contains("crashpad")
            && !name.contains("updater")
    });
    names.sort();
    names.dedup();

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

/// The .exe named by a command line or icon reference, quoted or with ,0; msiexec is no app.
fn command_image(command: &str) -> Option<PathBuf> {
    let command = command.trim().trim_start_matches('"');
    let end = command.to_ascii_lowercase().find(".exe")? + ".exe".len();
    let image = PathBuf::from(&command[..end]);
    (file_name(&image)? != "msiexec.exe").then_some(image)
}

/// The shortcut's image under install_dir; for Squirrel, the --processStart argument of Update.exe.
fn shortcut_image(shortcut: &Shortcut, install_dir: &Path) -> Option<String> {
    let target = Path::new(&shortcut.target);
    if !is_under(target, install_dir) {
        return None;
    }
    let name = file_name(target)?;
    if name != "update.exe" {
        return name.ends_with(".exe").then_some(name);
    }
    let rest = shortcut
        .arguments
        .split("--processStart")
        .nth(1)?
        .trim_start();
    let launched = match rest.strip_prefix('"') {
        Some(quoted) => quoted.split('"').next()?,
        None => rest.split_whitespace().next()?,
    };
    file_name(Path::new(launched))
}

fn file_name(path: &Path) -> Option<String> {
    Some(path.file_name()?.to_string_lossy().to_lowercase())
}

/// Rejects roots and shared locations, where matching processes would block on unrelated apps.
fn is_app_dir(dir: &Path) -> bool {
    let lower = dir.to_string_lossy().to_ascii_lowercase();
    let lower = lower.trim_end_matches('\\');
    let without_drive = lower.get(2..).unwrap_or_default();
    !without_drive.is_empty()
        && !BROAD_DIRS.contains(&without_drive)
        && !lower.ends_with(r"\appdata\local")
        && !lower.ends_with(r"\appdata\roaming")
        && !lower.ends_with(r"\appdata\local\programs")
        && !lower.contains(r"\windows\installer")
        && !lower.contains(r"\package cache\")
}

#[cfg(test)]
#[path = "winget_tests.rs"]
mod tests;
