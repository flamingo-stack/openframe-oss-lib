use semver::Version;
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;

use crate::utils::version_comparator::{parse_version, precedence};

#[cfg(target_os = "windows")]
pub(super) const SCRIPT_PRELUDE: &str = r#"$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$root = $args[0]
$choco = Join-Path $root 'bin\choco.exe'

function Invoke-Choco {
    $ErrorActionPreference = 'Continue'
    $global:LASTEXITCODE = 1
    $output = @(& $choco @args 2>$null)
    [pscustomobject]@{ exit = $LASTEXITCODE; output = $output }
}

"#;

#[cfg(target_os = "windows")]
const FACTS_SCRIPT: &str = r#"$run = Invoke-Choco --version
$versionExit = $run.exit
$version = ''
if ($run.output.Count -gt 0) { $version = ([string]$run.output[-1]).Trim() }

$pinned = $false
if ($versionExit -eq 0) {
    $run = Invoke-Choco pin list --limit-output
    if ($run.exit -ne 0) { exit 3 }
    $pinned = @($run.output | Where-Object { ([string]$_ -split '\|')[0] -eq 'chocolatey' }).Count -gt 0
}

$weakSids = 'S-1-1-0', 'S-1-5-11', 'S-1-5-32-545'
$writeRights = 0x500C0006
function Test-WeakAcl($path) {
    if (-not (Test-Path -LiteralPath $path)) { return $false }
    foreach ($rule in (Get-Acl -LiteralPath $path).Access) {
        if ($rule.AccessControlType -ne 'Allow') { continue }
        try { $sid = $rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value } catch { continue }
        if (($weakSids -contains $sid) -and (([int64]$rule.FileSystemRights -band $writeRights) -ne 0)) { return $true }
    }
    return $false
}
$weakAcl = (Test-WeakAcl $root) -or (Test-WeakAcl (Join-Path $root 'bin'))

$signature = Get-AuthenticodeSignature -LiteralPath $choco
if ($signature.Status -notin 'Valid', 'NotSigned', 'HashMismatch', 'NotTrusted') { exit 4 }
$signed = ($signature.Status -eq 'Valid') -and $signature.SignerCertificate -and ($signature.SignerCertificate.Subject -like '*Chocolatey Software*')

$otherInstall = @(
    (Join-Path $env:ProgramData 'chocolatey'), "$env:SystemDrive\Chocolatey" |
        Where-Object { ($_.TrimEnd('\') -ne $root) -and (Test-Path -LiteralPath (Join-Path $_ 'bin\choco.exe')) }
).Count -gt 0

$licensed = Test-Path -LiteralPath (Join-Path $root 'lib\chocolatey.extension')

$installed = @(Get-ChildItem -LiteralPath (Join-Path $root 'lib') -Directory -ErrorAction SilentlyContinue | ForEach-Object { $_.Name })

$key = 'HKLM:\SOFTWARE\OpenFrame\Chocolatey'
$marker = ''
$upgradeBlocked = ''
$recorded = @()
if (Test-Path -LiteralPath $key) {
    $values = Get-ItemProperty -LiteralPath $key
    if ($values.InstallPath) { $marker = [string]$values.InstallPath }
    if ($values.UpgradeBlocked) { $upgradeBlocked = [string]$values.UpgradeBlocked }
    if (Test-Path -LiteralPath "$key\Packages") {
        $recorded = @((Get-Item -LiteralPath "$key\Packages").Property | Where-Object { $_ })
    }
}

$json = ConvertTo-Json -Compress -InputObject @{
    root = $root
    versionExit = $versionExit
    version = $version
    pinned = $pinned
    weakAcl = $weakAcl
    signed = [bool]$signed
    otherInstall = $otherInstall
    licensed = $licensed
    installed = $installed
    marker = $marker
    upgradeBlocked = $upgradeBlocked
    recorded = $recorded
}
[regex]::Replace($json, '[^\x00-\x7F]', { param($m) '\u{0:x4}' -f [int][char]$m.Value })
"#;

const MANAGED_FROM: Version = Version::new(2, 4, 1);
const CHOCOLATEY: &str = "chocolatey";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
struct Facts {
    root: String,
    version_exit: i32,
    version: String,
    pinned: bool,
    weak_acl: bool,
    signed: bool,
    other_install: bool,
    licensed: bool,
    installed: Vec<String>,
    marker: String,
    upgrade_blocked: String,
    recorded: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct ChocoReport {
    #[serde(skip_serializing_if = "Option::is_none")]
    version: Option<String>,
    edition: Edition,
    ours: bool,
    status: Status,
    #[serde(skip_serializing_if = "Option::is_none")]
    reason: Option<Reason>,
    options: Vec<AdminOption>,
    packages: Vec<String>,
    existing_packages: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum Edition {
    OpenSource,
    Licensed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum Status {
    Managed,
    UpgradeRequired,
    ActionRequired,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum Reason {
    #[serde(rename = "VERSION_1")]
    Version1,
    UpgradeBlocked,
    Pinned,
    Licensed,
    Broken,
    Unsigned,
    WeakAcl,
    SeveralInstalls,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum AdminOption {
    DontTouch,
    AdminFix,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Verdict {
    Managed,
    UpgradeRequired,
    ActionRequired(Reason),
}

#[cfg(target_os = "windows")]
pub(super) fn root() -> String {
    use winreg::enums::HKEY_LOCAL_MACHINE;
    use winreg::RegKey;

    const ENVIRONMENT: &str = r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment";

    let root = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey(ENVIRONMENT)
        .ok()
        .and_then(|key| key.get_value::<String, _>("ChocolateyInstall").ok())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| {
            let program_data =
                std::env::var("ProgramData").unwrap_or_else(|_| r"C:\ProgramData".to_string());
            format!(r"{}\chocolatey", program_data)
        });
    root.trim().trim_end_matches('\\').to_string()
}

#[cfg(target_os = "windows")]
pub(super) async fn report() -> Option<ChocoReport> {
    use crate::executor::{execute_script, Privilege, ScriptParams};
    use tracing::warn;

    let result = execute_script(ScriptParams {
        code: &format!("{SCRIPT_PRELUDE}{FACTS_SCRIPT}"),
        shell: "powershell",
        args: &[root()],
        timeout_secs: super::PRESENCE_PROBE_TIMEOUT_SECS,
        privilege: Privilege::Agent,
        env_vars: &[],
    })
    .await;

    if result.timed_out || result.retcode != 0 {
        warn!(
            retcode = result.retcode,
            timed_out = result.timed_out,
            stderr = %result.stderr.trim(),
            "Could not read the Chocolatey install"
        );
        return None;
    }

    match serde_json::from_str::<Facts>(result.stdout.trim()) {
        Ok(facts) => Some(assess(&facts)),
        Err(e) => {
            warn!(error = %e, "Unparseable Chocolatey install facts");
            None
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub(super) async fn report() -> Option<ChocoReport> {
    None
}

#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
fn assess(facts: &Facts) -> ChocoReport {
    let version = if facts.version_exit == 0 {
        parse_version(&facts.version)
    } else {
        None
    };
    let ours = same_dir(&facts.marker, &facts.root);
    let verdict = verdict(facts, version.as_ref());

    let (status, reason, options) = match verdict {
        Verdict::Managed => (Status::Managed, None, Vec::new()),
        Verdict::UpgradeRequired => (Status::UpgradeRequired, None, Vec::new()),
        Verdict::ActionRequired(reason) => (
            Status::ActionRequired,
            Some(reason),
            vec![AdminOption::DontTouch, AdminOption::AdminFix],
        ),
    };

    let (packages, existing_packages) = facts
        .installed
        .iter()
        .filter(|id| !id.eq_ignore_ascii_case(CHOCOLATEY))
        .cloned()
        .partition(|id| {
            ours || facts
                .recorded
                .iter()
                .any(|recorded| recorded.eq_ignore_ascii_case(id))
        });

    ChocoReport {
        version: version.map(|version| version.to_string()),
        edition: if facts.licensed {
            Edition::Licensed
        } else {
            Edition::OpenSource
        },
        ours,
        status,
        reason,
        options,
        packages,
        existing_packages,
    }
}

#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
fn verdict(facts: &Facts, version: Option<&Version>) -> Verdict {
    let Some(version) = version else {
        return Verdict::ActionRequired(Reason::Broken);
    };
    let reason = if facts.other_install {
        Reason::SeveralInstalls
    } else if facts.weak_acl {
        Reason::WeakAcl
    } else if !facts.signed {
        Reason::Unsigned
    } else if facts.licensed {
        Reason::Licensed
    } else if version.major < 2 {
        Reason::Version1
    } else if precedence(version, &MANAGED_FROM) != Ordering::Less {
        return Verdict::Managed;
    } else if facts.pinned {
        Reason::Pinned
    } else if parse_version(&facts.upgrade_blocked)
        .is_some_and(|blocked| precedence(&blocked, version) == Ordering::Equal)
    {
        Reason::UpgradeBlocked
    } else {
        return Verdict::UpgradeRequired;
    };
    Verdict::ActionRequired(reason)
}

#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
fn same_dir(a: &str, b: &str) -> bool {
    let a = a.trim().trim_end_matches(['\\', '/']);
    !a.is_empty() && a.eq_ignore_ascii_case(b.trim().trim_end_matches(['\\', '/']))
}

#[cfg(test)]
#[path = "choco_tests.rs"]
mod tests;
