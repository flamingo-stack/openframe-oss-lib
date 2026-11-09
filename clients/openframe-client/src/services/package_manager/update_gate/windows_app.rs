use super::decide::is_under;
use super::{AppIdentity, MainImages, Undetermined};
use serde::Deserialize;
use std::path::{Path, PathBuf};
use tracing::warn;

pub(super) const SCRIPT_HELPERS: &str = r#"$shell = New-Object -ComObject WScript.Shell
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

function Invoke-Com($target, $member, $kind, $arguments) {
    $target.GetType().InvokeMember($member, $kind, $null, $target, $arguments)
}

# An MSI that leaves InstallLocation and DisplayIcon empty still knows where its shortcuts point: the key file of
# each shortcut's component, read from the cached package.
function Get-MsiShortcutTargets($codes) {
    $targets = @()
    $errors = @()
    try {
        $msi = New-Object -ComObject WindowsInstaller.Installer
    } catch {
        return @{ targets = $targets; errors = @("WindowsInstaller.Installer: $(($_.Exception.Message -split "`r?`n")[0])") }
    }
    $query = 'SELECT `Component`.`ComponentId` FROM `Shortcut`, `Component` WHERE `Shortcut`.`Component_` = `Component`.`Component`'
    foreach ($code in $codes) {
        if ($code -notmatch '^\{[0-9A-Fa-f-]{36}\}$') { continue }
        try {
            $package = [string](Invoke-Com $msi 'ProductInfo' 'GetProperty' @($code, 'LocalPackage'))
            if (-not $package) { continue }
            $database = Invoke-Com $msi 'OpenDatabase' 'InvokeMethod' @($package, 0)
            $view = Invoke-Com $database 'OpenView' 'InvokeMethod' @($query)
            [void](Invoke-Com $view 'Execute' 'InvokeMethod' @())
            while ($record = Invoke-Com $view 'Fetch' 'InvokeMethod' @()) {
                $component = [string](Invoke-Com $record 'StringData' 'GetProperty' @(1))
                $path = [string](Invoke-Com $msi 'ComponentPath' 'GetProperty' @($code, $component))
                # ComponentPath also answers with registry key paths such as 21:\Software\...; only a file locates the app.
                if ($path -match '^[A-Za-z]:\\') { $targets += $path }
            }
            [void](Invoke-Com $view 'Close' 'InvokeMethod' @())
        } catch {
            $errors += "$code : $(($_.Exception.Message -split "`r?`n")[0])"
        }
    }
    @{ targets = $targets; errors = $errors }
}

"#;

pub(super) const SCRIPT_OUTPUT: &str = r#"$json = ConvertTo-Json -InputObject @{ shortcuts = $shortcuts; packages = $packages } -Depth 4 -Compress
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
pub(super) struct Output {
    pub(super) shortcuts: Vec<Shortcut>,
    pub(super) packages: Vec<Package>,
}

#[derive(Debug, Deserialize)]
pub(super) struct Shortcut {
    target: String,
    #[serde(default)]
    arguments: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Package {
    pub(super) id: String,
    pub(super) installed: bool,
    #[serde(default)]
    pub(super) installed_location: Option<String>,
    #[serde(default)]
    pub(super) uninstall_command: Option<String>,
    #[serde(default)]
    pub(super) arp_install_location: Option<String>,
    #[serde(default)]
    pub(super) arp_display_icon: Option<String>,
    #[serde(default)]
    pub(super) appx_applications: Vec<AppxApplication>,
    /// Key files of the MSI's shortcut components, for an MSI that records no install location.
    #[serde(default)]
    pub(super) msi_shortcut_targets: Vec<String>,
    #[serde(default)]
    pub(super) msi_shortcut_errors: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct AppxApplication {
    executable: String,
    /// `none` hides the entry from Start: a helper, not the app.
    #[serde(default)]
    app_list_entry: Option<String>,
}

/// Where the package's app is installed and what it runs as.
pub(super) fn identity(
    package: &Package,
    shortcuts: &[Shortcut],
) -> Result<AppIdentity, Undetermined> {
    if !package.installed {
        return Err(Undetermined::NotInstalled);
    }

    let msi_images: Vec<PathBuf> = package
        .msi_shortcut_targets
        .iter()
        .filter_map(|target| command_image(target))
        .collect();
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
    .chain(
        msi_images
            .iter()
            .filter_map(|image| image.parent().map(Path::to_path_buf)),
    )
    .find(|dir| is_app_dir(dir))
    .ok_or_else(|| {
        if !package.msi_shortcut_errors.is_empty() {
            warn!(package = %package.id, errors = ?package.msi_shortcut_errors, "MSI shortcut lookup failed");
        }
        Undetermined::NoInstallLocation
    })?;

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
            .chain(
                msi_images
                    .iter()
                    .filter(|image| is_under(image, &install_dir))
                    .filter_map(|image| file_name(image)),
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
#[path = "windows_app_tests.rs"]
mod tests;
