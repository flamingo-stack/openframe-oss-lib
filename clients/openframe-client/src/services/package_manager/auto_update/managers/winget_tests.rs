use super::*;

/// `OUTDATED_SCRIPT` output captured on Windows 10, 2026-10-16 (34 packages; Rainmeter, with
/// an inexact installed version, correctly absent).
const CAPTURED: &str = r#"["7zip.7zip","ShareX.ShareX","Git.Git","Greenshot.Greenshot","ChemTableSoftware.RegOrganizer","TeamViewer.TeamViewer","Ghisler.TotalCommander","RARLab.WinRAR","WireGuard.WireGuard","Nvidia.PhysX","Microsoft.msodbcsql.17","Microsoft.VisualStudio.Professional","MichaelTippach.ASIO4ALL","JRSoftware.InnoSetup","DominikReichl.KeePass","ShiningLight.OpenSSL.Dev","GitExtensionsTeam.GitExtensions","Microsoft.WindowsInstallationAssistant","Python.Launcher","Microsoft.XNARedist","SaferNetworking.SpybotAntiBeacon","Microsoft.DotNet.DesktopRuntime.8","WiXToolset.WiXToolset","Microsoft.DotNet.DesktopRuntime.6","Microsoft.DotNet.DesktopRuntime.7","Rustlang.Rustup","Spotify.Spotify","Obsidian.Obsidian","Python.Python.3.9","Python.Python.3.11","Microsoft.VisualStudioCode","Python.Python.3.10","Microsoft.WindowsTerminal","SlackTechnologies.Slack"]
"#;

fn query(retcode: i32, stdout: &str) -> ExecResult {
    ExecResult {
        stdout: stdout.to_string(),
        stderr: String::new(),
        retcode,
        timed_out: false,
    }
}

fn exited(retcode: u32) -> ExecResult {
    ExecResult {
        stdout: "Found Vendor App\nStarting package install...\nInstaller failed".to_string(),
        stderr: String::new(),
        retcode: retcode as i32,
        timed_out: false,
    }
}

#[test]
fn captured_output_parses_into_winget_packages() {
    let packages = read_outdated(&query(0, CAPTURED)).unwrap();

    assert_eq!(packages.len(), 34);
    assert_eq!(
        packages[0],
        PackageRef::Winget {
            id: "7zip.7zip".to_string()
        }
    );
    assert!(packages.contains(&PackageRef::Winget {
        id: "SlackTechnologies.Slack".to_string()
    }));
}

#[test]
fn nothing_outdated_is_an_empty_list() {
    assert_eq!(read_outdated(&query(0, "[]\r\n")).unwrap(), vec![]);
}

#[test]
fn garbage_output_is_a_failure() {
    assert!(matches!(
        read_outdated(&query(0, "Import-Module : not found")),
        Err(QueryError::Failed(_))
    ));
}

#[test]
fn a_missing_powershell_module_makes_winget_unavailable_not_failed() {
    assert!(matches!(
        read_outdated(&query(3, "")),
        Err(QueryError::Unavailable(_))
    ));
}

#[test]
fn any_other_exit_code_is_a_failure() {
    assert!(matches!(
        read_outdated(&query(85, "")),
        Err(QueryError::Failed(_))
    ));
}

#[test]
fn exit_codes_map_to_outcomes() {
    let cases: &[(u32, &str)] = &[
        (0, "upgraded"),
        (0x8A15_0109, "upgraded"),
        (0x8A15_002B, "already latest"),
        (0x8A15_0101, "deferred"),
        (0x8A15_0102, "deferred"),
        (0x8A15_0103, "deferred"),
        (0x8A15_010A, "deferred"),
        (1618, "deferred"),
        (85, "deferred"),
        (0x8A15_0068, "failed"),
        (0x8A15_0050, "failed"),
        (1, "failed"),
    ];
    for (retcode, expected) in cases {
        let kind = match interpret(&exited(*retcode)) {
            UpgradeOutcome::Upgraded => "upgraded",
            UpgradeOutcome::AlreadyLatest => "already latest",
            UpgradeOutcome::Deferred(_) => "deferred",
            UpgradeOutcome::Failed(_) => "failed",
        };
        assert_eq!(kind, *expected, "0x{retcode:08X}");
    }
}

#[test]
fn a_timeout_fails_whatever_the_exit_code() {
    let result = ExecResult {
        timed_out: true,
        ..exited(98)
    };

    assert_eq!(
        interpret(&result),
        UpgradeOutcome::Failed("timed out".to_string())
    );
}

#[test]
fn a_failure_names_the_code_and_the_last_line() {
    assert_eq!(
        interpret(&exited(0x8A15_0068)),
        UpgradeOutcome::Failed("winget exited 0x8A150068: Installer failed".to_string())
    );
}
