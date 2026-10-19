use std::time::Duration;

use tracing::{info, warn};

use crate::models::CodeSignature;

const INSPECTION_TIMEOUT: Duration = Duration::from_secs(30);

/// Reports who signed the running binary so the server can reject agents rebuilt or patched outside our release pipeline.
/// Never fails: an inspection error is reported as an invalid signature and left for the server policy to judge.
pub async fn inspect_current_executable() -> CodeSignature {
    let executable = match std::env::current_exe() {
        Ok(path) => path,
        Err(e) => {
            warn!(
                "Failed to resolve current executable for signature check: {:#}",
                e
            );
            return CodeSignature::invalid();
        }
    };

    let signature = match tokio::time::timeout(INSPECTION_TIMEOUT, inspect(&executable)).await {
        Ok(Ok(signature)) => signature,
        Ok(Err(e)) => {
            warn!(
                "Failed to inspect code signature of {}: {:#}",
                executable.display(),
                e
            );
            CodeSignature::invalid()
        }
        Err(_) => {
            warn!(
                "Code signature inspection of {} timed out",
                executable.display()
            );
            CodeSignature::invalid()
        }
    };

    info!(
        "Code signature of {}: status {:?}, signer '{}'",
        executable.display(),
        signature.status,
        signature.signer
    );
    signature
}

#[cfg(target_os = "macos")]
const CODESIGN_PATH: &str = "/usr/bin/codesign";

#[cfg(target_os = "macos")]
const APPLE_ANCHOR_REQUIREMENT: &str = "-R=anchor apple generic";

#[cfg(target_os = "macos")]
async fn inspect(executable: &std::path::Path) -> anyhow::Result<CodeSignature> {
    use anyhow::Context;
    use tokio::process::Command;

    let verification = Command::new(CODESIGN_PATH)
        .args(["--verify", "--strict", APPLE_ANCHOR_REQUIREMENT])
        .arg(executable)
        .kill_on_drop(true)
        .output()
        .await
        .context("Failed to run codesign --verify")?;
    if !verification.status.success() {
        let stderr = String::from_utf8_lossy(&verification.stderr);
        return Ok(classify_failed_verification(&stderr));
    }

    let details = Command::new(CODESIGN_PATH)
        .arg("-dv")
        .arg(executable)
        .kill_on_drop(true)
        .output()
        .await
        .context("Failed to run codesign -dv")?;
    let stderr = String::from_utf8_lossy(&details.stderr);
    Ok(parse_team_identifier(&stderr)
        .map(CodeSignature::valid)
        .unwrap_or_else(CodeSignature::invalid))
}

#[cfg(target_os = "macos")]
fn classify_failed_verification(stderr: &str) -> CodeSignature {
    if stderr.contains("not signed at all") {
        CodeSignature::unsigned()
    } else {
        CodeSignature::invalid()
    }
}

/// `codesign -dv` prints `TeamIdentifier=not set` for ad-hoc signatures, which carry no identity.
#[cfg(target_os = "macos")]
fn parse_team_identifier(codesign_details: &str) -> Option<String> {
    codesign_details
        .lines()
        .find_map(|line| line.strip_prefix("TeamIdentifier="))
        .map(str::trim)
        .filter(|team_id| !team_id.is_empty() && *team_id != "not set")
        .map(str::to_string)
}

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Prints `<Status>|<signer simple name>`; `{path}` is filled in at run time.
#[cfg(windows)]
const AUTHENTICODE_SCRIPT: &str =
    "$s = Get-AuthenticodeSignature -LiteralPath '{path}'; \
     $signer = if ($s.SignerCertificate) { $s.SignerCertificate.GetNameInfo('SimpleName', $false) } else { '' }; \
     Write-Output \"$($s.Status)|$signer\"";

#[cfg(windows)]
async fn inspect(executable: &std::path::Path) -> anyhow::Result<CodeSignature> {
    use anyhow::{anyhow, Context};
    use tokio::process::Command;

    let powershell = crate::platform::get_powershell_path().map_err(|e| anyhow!(e))?;
    let escaped_path = executable.display().to_string().replace('\'', "''");
    let script = AUTHENTICODE_SCRIPT.replace("{path}", &escaped_path);

    let output = Command::new(powershell)
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .creation_flags(CREATE_NO_WINDOW)
        .kill_on_drop(true)
        .output()
        .await
        .context("Failed to run Get-AuthenticodeSignature")?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(parse_authenticode_output(&stdout))
}

#[cfg(windows)]
fn parse_authenticode_output(stdout: &str) -> CodeSignature {
    let (status, signer) = stdout.trim().split_once('|').unwrap_or(("", ""));
    match status {
        "Valid" if !signer.trim().is_empty() => CodeSignature::valid(signer.trim().to_string()),
        "NotSigned" => CodeSignature::unsigned(),
        _ => CodeSignature::invalid(),
    }
}

#[cfg(not(any(target_os = "macos", windows)))]
async fn inspect(_executable: &std::path::Path) -> anyhow::Result<CodeSignature> {
    Ok(CodeSignature::unsigned())
}

#[cfg(test)]
#[path = "code_signature_tests.rs"]
mod tests;
