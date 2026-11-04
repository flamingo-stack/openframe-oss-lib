// Windows PowerShell 5.1 reads BOM-less script files as ANSI: a multi-byte
// UTF-8 character can decode into a smart quote (e.g. 0x94 from an em-dash)
// that terminates a string early and structurally breaks the script.
#[cfg(target_os = "windows")]
#[test]
fn windows_update_script_is_ascii() {
    assert!(
        super::windows::UPDATE_SCRIPT_WINDOWS.is_ascii(),
        "UPDATE_SCRIPT_WINDOWS must stay pure ASCII"
    );
}

// Server 2012 / 2012 R2 ship PowerShell 3.0 / 4.0; a 5.0-only cmdlet fails there before the swap.
#[cfg(target_os = "windows")]
#[test]
fn windows_update_script_stays_powershell3_compatible() {
    let script = super::windows::UPDATE_SCRIPT_WINDOWS;
    // The header comment names the banned cmdlets, so only executable lines are checked.
    let code: Vec<&str> = script
        .lines()
        .filter(|l| !l.trim_start().starts_with('#'))
        .collect();
    let code = code.join("\n");
    for cmdlet in ["New-Guid", "Expand-Archive", "Compress-Archive"] {
        assert!(
            !code.contains(cmdlet),
            "UPDATE_SCRIPT_WINDOWS must not use the PowerShell 5.0-only cmdlet {cmdlet}"
        );
    }
    assert!(script.contains("# Requires Windows PowerShell 3.0+"));
    assert!(script.contains("[string]$NewExePath,"));
    assert!(script.contains("Set-UpdatePhase -Phase \"failed\" -Reason"));
    let rollback = &script[script.find("All restore attempts failed").unwrap()
        ..script.find("Rollback complete").unwrap()];
    assert!(
        rollback
            .find("Set-UpdatePhase -Phase \"rolled_back\"")
            .unwrap()
            < rollback.find("Start-Service").unwrap(),
        "rolled_back must be stamped before the service is started"
    );
    assert!(script.contains("-NotePropertyName last_error"));
}

#[cfg(target_os = "windows")]
#[test]
fn windows_update_script_records_the_innermost_error_reason() {
    let script = super::windows::UPDATE_SCRIPT_WINDOWS;
    assert!(script.contains("$failure = Get-ErrorReason $_"));
    assert!(script.contains("$rollbackFailure = Get-ErrorReason $_"));
    assert!(script.contains("-Reason \"$failure; rollback failed: $rollbackFailure\""));
    assert!(!script.contains("rollback failed: $_"));
}

// Start-Service nests its Win32 reason two exceptions deep under a message that only names the service.
#[cfg(target_os = "windows")]
#[test]
fn windows_get_error_reason_appends_the_innermost_message_once() {
    const CASES: &str = r#"
function Get-Reason([scriptblock]$Action) { try { & $Action } catch { Get-ErrorReason $_ } }
$win32 = New-Object System.Exception -ArgumentList 'win32 reason'
$middle = New-Object System.InvalidOperationException -ArgumentList 'cannot start service', $win32
Get-Reason { throw (New-Object System.InvalidOperationException -ArgumentList 'service cannot be started: cannot start service', $middle) }
Get-Reason { throw (New-Object System.InvalidOperationException -ArgumentList 'failed: win32 reason', $win32) }
Get-Reason { throw 'plain failure' }
"#;
    let script = super::windows::UPDATE_SCRIPT_WINDOWS;
    let start = script.find("function Get-ErrorReason").unwrap();
    let end = start + script[start..].find("\n}\n").unwrap() + 3;
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("reason.ps1");
    std::fs::write(
        &path,
        format!(
            "$ErrorActionPreference = 'Stop'\n{}{CASES}",
            &script[start..end]
        ),
    )
    .unwrap();

    let output = std::process::Command::new(crate::platform::get_powershell_path())
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
        ])
        .arg(&path)
        .output()
        .unwrap();

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(output.status.success(), "{stdout}");
    let lines: Vec<&str> = stdout
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .collect();
    assert_eq!(
        lines,
        [
            "service cannot be started: cannot start service (win32 reason)",
            "failed: win32 reason",
            "plain failure",
        ]
    );
}

#[cfg(target_os = "macos")]
#[test]
fn macos_update_script_stamps_failed_phase() {
    let script = super::macos::UPDATE_SCRIPT_MACOS;
    assert!(script.contains("set_update_phase \"failed\""));
    let rollback =
        &script[script.find("fail_rollback()").unwrap()..script.find("Rollback complete").unwrap()];
    assert!(
        rollback.find("set_update_phase \"rolled_back\"").unwrap()
            < rollback.find("launchctl load").unwrap(),
        "rolled_back must be stamped before the service is loaded"
    );
}

#[cfg(target_os = "macos")]
#[test]
fn macos_update_script_is_ascii() {
    assert!(
        super::macos::UPDATE_SCRIPT_MACOS.is_ascii(),
        "UPDATE_SCRIPT_MACOS must stay pure ASCII"
    );
    assert!(
        super::macos::UPDATER_PLIST_TEMPLATE.is_ascii(),
        "UPDATER_PLIST_TEMPLATE must stay pure ASCII"
    );
}
