use anyhow::{Context, Result};
use std::path::{Path, PathBuf};
use tracing::{info, warn};

use super::directories::get_update_staging_directory;
#[cfg(windows)]
use super::get_powershell_path;

/// Generate a PowerShell script to cleanup the OpenFrame binary after process exit
///
/// This script will:
/// 1. Wait for the current process to exit
/// 2. Force delete the binary file
/// 3. Delete itself
/// 4. Remove empty install directories (bin and the update staging dir, then OpenFrame)
pub fn generate_binary_cleanup_script(
    install_path: &Path,
    current_pid: u32,
    bin_dir: Option<&PathBuf>,
    staging_dir: &Path,
) -> String {
    let install_path_str = install_path.to_string_lossy().replace('\'', "''");
    let bin_dir_str = bin_dir
        .map(|p| p.to_string_lossy().replace('\'', "''"))
        .unwrap_or_default();
    let staging_dir_str = staging_dir.to_string_lossy().replace('\'', "''");

    format!(
        r#"
# OpenFrame Binary Cleanup Script
# This script cleans up the OpenFrame binary after the main process exits

$ErrorActionPreference = "SilentlyContinue"
$ProcessId = {current_pid}
$BinaryPath = '{install_path_str}'
$BinDir = '{bin_dir_str}'
$StagingDir = '{staging_dir_str}'

function Remove-EmptyDir([string]$Path) {{
    if (($Path -eq "") -or -not (Test-Path -LiteralPath $Path)) {{
        return $true
    }}
    $items = Get-ChildItem -LiteralPath $Path -Force -ErrorAction SilentlyContinue
    if ($items.Count -ne 0) {{
        return $false
    }}
    for ($attempt = 1; $attempt -le 3; $attempt++) {{
        try {{
            Remove-Item -LiteralPath $Path -Force -ErrorAction Stop
            return $true
        }} catch {{
            if ($attempt -lt 3) {{
                Start-Sleep -Seconds 1
            }}
        }}
    }}
    return $false
}}

# Wait for main process to exit (max 30 seconds with verification)
$waited = 0
$maxWaitSeconds = 30

while ($waited -lt $maxWaitSeconds) {{
    try {{
        $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
        if ($null -eq $process) {{
            break
        }}
        Start-Sleep -Milliseconds 500
        $waited += 0.5
    }} catch {{
        break
    }}
}}

# Verify process is really gone
if ($waited -ge $maxWaitSeconds) {{
    try {{
        Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }} catch {{
        # Process likely already gone
    }}
}}

# Final verification
try {{
    $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if ($null -ne $process) {{
        Remove-Item -LiteralPath $PSCommandPath -Force
        exit 1
    }}
}} catch {{
    # Process is gone, which is what we want
}}

# Force delete the binary with retry logic
if (Test-Path $BinaryPath) {{
    $removed = $false
    $maxRetries = 5

    for ($attempt = 1; $attempt -le $maxRetries; $attempt++) {{
        try {{
            Remove-Item -Path $BinaryPath -Force -ErrorAction Stop
            $removed = $true
            break
        }} catch {{
            if ($attempt -lt $maxRetries) {{
                $waitSeconds = [math]::Min([math]::Pow(2, $attempt - 1), 8)
                Start-Sleep -Seconds $waitSeconds
            }}
        }}
    }}

    # If standard removal failed, try with takeown and icacls
    if (-not $removed -and (Test-Path $BinaryPath)) {{
        try {{
            takeown /F $BinaryPath /A 2>&1 | Out-Null
            icacls $BinaryPath /grant Everyone:F /T /C /Q 2>&1 | Out-Null
            Start-Sleep -Milliseconds 500
            Remove-Item -Path $BinaryPath -Force -ErrorAction Stop
            $removed = $true
        }} catch {{
            # Silent fail
        }}
    }}
}}

# This script lives in the staging dir, so delete it before the emptiness checks;
# PowerShell has already read the whole file
Remove-Item -LiteralPath $PSCommandPath -Force

$binRemoved = Remove-EmptyDir $BinDir
$stagingRemoved = Remove-EmptyDir $StagingDir
if (($BinDir -ne "") -and $binRemoved -and $stagingRemoved) {{
    Remove-EmptyDir (Split-Path -Parent $BinDir) | Out-Null
}}

exit 0
"#,
        current_pid = current_pid,
        install_path_str = install_path_str,
        bin_dir_str = bin_dir_str,
        staging_dir_str = staging_dir_str
    )
}

/// Create and execute the binary cleanup script
///
/// This will create a temporary PowerShell script and execute it in the background.
/// The script will wait for the current process to exit and then clean up the binary.
pub fn execute_binary_cleanup_script(install_path: &Path, bin_dir: Option<&PathBuf>) -> Result<()> {
    use std::fs;
    use std::io::Write;
    use std::process::Command;

    // Get current process ID
    let current_pid = std::process::id();

    info!("Creating binary cleanup script for PID: {}", current_pid);

    // Same dir as the updater script, for the same reason: tools that block SystemTemp scripts
    let staging_dir = get_update_staging_directory();
    fs::create_dir_all(&staging_dir).context("Failed to create update staging directory")?;
    let script_name = format!("openframe_binary_cleanup_{}.ps1", uuid::Uuid::new_v4());
    let script_path = staging_dir.join(&script_name);

    info!("Cleanup script path: {}", script_path.display());

    // Generate script content
    let script_content =
        generate_binary_cleanup_script(install_path, current_pid, bin_dir, &staging_dir);

    // Write script to file
    let mut file =
        fs::File::create(&script_path).context("Failed to create binary cleanup script file")?;

    file.write_all(script_content.as_bytes())
        .context("Failed to write binary cleanup script content")?;

    info!("Starting binary cleanup script in background...");

    // Execute PowerShell script in the background (detached, no window, no output)
    use std::process::Stdio;

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        const CREATE_BREAKAWAY_FROM_JOB: u32 = 0x01000000;
        const ERROR_ACCESS_DENIED: i32 = 5;

        let ps_path = get_powershell_path();
        info!("Using PowerShell: {}", ps_path);

        let spawn = |flags: u32| {
            Command::new(&ps_path)
                .args([
                    "-NoProfile",
                    "-WindowStyle",
                    "Hidden",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-File",
                    &script_path.to_string_lossy(),
                ])
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .creation_flags(flags)
                .spawn()
        };

        match spawn(CREATE_NO_WINDOW | CREATE_BREAKAWAY_FROM_JOB) {
            Err(e) if e.raw_os_error() == Some(ERROR_ACCESS_DENIED) => {
                warn!("Job object does not allow breakaway, starting cleanup script inside it");
                spawn(CREATE_NO_WINDOW)
            }
            result => result,
        }
        .context("Failed to spawn binary cleanup script")?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        Command::new("powershell.exe")
            .args(&[
                "-NoProfile",
                "-WindowStyle",
                "Hidden",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                &script_path.to_string_lossy(),
            ])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .context("Failed to spawn binary cleanup script")?;
    }

    info!("Binary cleanup script started successfully");
    Ok(())
}

#[cfg(test)]
#[path = "windows_cleanup_tests.rs"]
mod tests;
