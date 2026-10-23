use super::*;

/// OUTDATED_SCRIPT output from Windows 10; Rainmeter is absent, its installed version is inexact.
const CAPTURED: &str = r#"[{"id":"7zip.7zip","installed":"23.01","available":"24.09"},{"id":"ShareX.ShareX","installed":"16.1.0","available":"17.0.0"},{"id":"Git.Git","installed":"2.44.0","available":"2.47.1"},{"id":"SlackTechnologies.Slack","installed":"4.38.125","available":"4.41.105"}]
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
fn captured_output_parses_into_winget_packages_with_versions() {
    let packages = read_outdated(&query(0, CAPTURED)).unwrap();

    assert_eq!(packages.len(), 4);
    assert_eq!(
        packages[0],
        OutdatedPackage {
            package: PackageRef::Winget {
                id: "7zip.7zip".to_string()
            },
            installed_version: Some("23.01".to_string()),
            available_version: Some("24.09".to_string()),
        }
    );
    assert!(packages.iter().any(|p| p.package
        == PackageRef::Winget {
            id: "SlackTechnologies.Slack".to_string()
        }));
}

#[test]
fn missing_or_empty_versions_are_absent() {
    let packages = read_outdated(&query(0, r#"[{"id":"Vendor.App","installed":""}]"#)).unwrap();

    assert_eq!(packages[0].installed_version, None);
    assert_eq!(packages[0].available_version, None);
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
        (0x8A15_0109, "upgraded, reboot"),
        (0x8A15_002B, "already latest"),
        (0x8A15_0101, "in use"),
        (0x8A15_0103, "in use"),
        (0x8A15_0102, "busy"),
        (0x8A15_010A, "busy"),
        (1618, "busy"),
        (85, "busy"),
        (0x8A15_0068, "failed"),
        (0x8A15_0050, "failed"),
        (1, "failed"),
    ];
    for (retcode, expected) in cases {
        let kind = match interpret(&exited(*retcode)) {
            UpgradeOutcome::Upgraded {
                reboot_required: false,
            } => "upgraded",
            UpgradeOutcome::Upgraded {
                reboot_required: true,
            } => "upgraded, reboot",
            UpgradeOutcome::AlreadyLatest => "already latest",
            UpgradeOutcome::InUse(_) => "in use",
            UpgradeOutcome::Busy(_) => "busy",
            UpgradeOutcome::Failed { .. } => "failed",
            UpgradeOutcome::TimedOut => "timed out",
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

    assert_eq!(interpret(&result), UpgradeOutcome::TimedOut);
}

#[test]
fn a_failure_names_the_code_and_the_last_line() {
    assert_eq!(
        interpret(&exited(0x8A15_0068)),
        UpgradeOutcome::Failed {
            exit_code: 0x8A15_0068,
            message: "winget exited 0x8A150068: Installer failed".to_string()
        }
    );
}
