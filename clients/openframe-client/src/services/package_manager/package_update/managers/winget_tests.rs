use super::*;

/// Rows in the shape PROBE_SCRIPT prints (`ConvertTo-Json` of installed, available, source, update).
fn rows(rows: &str) -> ExecResult {
    query(0, rows)
}

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
fn an_updatable_row_from_a_winget_source_is_outdated_with_its_versions() {
    let probe = read_probe(&rows(
        r#"[{"installed":"23.01","available":"24.09","source":"winget","update":true}]"#,
    ))
    .unwrap();

    assert_eq!(
        probe,
        Probe {
            state: ProbeState::Outdated,
            installed_version: Some("23.01".to_string()),
            available_version: Some("24.09".to_string()),
        }
    );
}

#[test]
fn a_row_without_an_update_is_up_to_date() {
    let probe = read_probe(&rows(
        r#"[{"installed":"24.09","available":"24.09","source":"winget","update":false}]"#,
    ))
    .unwrap();

    assert_eq!(probe.state, ProbeState::UpToDate);
}

#[test]
fn no_row_means_not_installed() {
    let probe = read_probe(&rows("[]\r\n")).unwrap();

    assert_eq!(probe.state, ProbeState::NotInstalled);
    assert_eq!(probe.installed_version, None);
}

#[test]
fn rows_winget_cannot_upgrade_say_why() {
    let cases = [
        r#"[{"installed":"2.1","available":"2.2","source":"","update":true}]"#,
        r#"[{"installed":"< 3.0.2","available":"3.1","source":"winget","update":true}]"#,
    ];
    for case in cases {
        assert!(
            matches!(
                read_probe(&rows(case)).unwrap().state,
                ProbeState::NotUpgradable(_)
            ),
            "{case}"
        );
    }
}

#[test]
fn of_several_rows_an_upgradable_outdated_one_wins() {
    let probe = read_probe(&rows(
        r#"[{"installed":"1.0","available":"1.0","source":"winget","update":false},
            {"installed":"1.0","available":"2.0","source":"winget","update":true}]"#,
    ))
    .unwrap();

    assert_eq!(probe.state, ProbeState::Outdated);
    assert_eq!(probe.available_version.as_deref(), Some("2.0"));
}

#[test]
fn missing_or_empty_versions_are_absent() {
    let probe = read_probe(&rows(r#"[{"installed":"","source":"winget"}]"#)).unwrap();

    assert_eq!(probe.installed_version, None);
    assert_eq!(probe.available_version, None);
}

#[test]
fn garbage_output_is_a_failure() {
    assert!(matches!(
        read_probe(&query(0, "Import-Module : not found")),
        Err(QueryError::Failed(_))
    ));
}

#[test]
fn a_missing_powershell_module_makes_winget_unavailable_not_failed() {
    assert!(matches!(
        read_probe(&query(3, "")),
        Err(QueryError::Unavailable(_))
    ));
}

#[test]
fn any_other_exit_code_is_a_failure() {
    assert!(matches!(
        read_probe(&query(85, "")),
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
            UpgradeOutcome::NotUpgradable(_) => "not upgradable",
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

#[test]
fn a_console_user_who_cannot_elevate_fails_instead_of_retrying() {
    for stderr in [
        "no linked token for the interactive user: A specified logon session does not exist.",
        "linked token is not elevated; interactive user is not a local administrator",
    ] {
        let result = ExecResult {
            stderr: stderr.to_string(),
            ..exited(85)
        };

        assert!(
            matches!(
                interpret(&result),
                UpgradeOutcome::Failed { exit_code: 85, .. }
            ),
            "{stderr}"
        );
    }
}

#[tokio::test]
async fn the_probe_output_keeps_non_ascii_text() {
    let emit = PROBE_SCRIPT.trim_end().lines().last().unwrap();
    let code = format!(
        "$json = ConvertTo-Json -InputObject @{{ installed = '1.0-' + [char]0x0414 + [char]0x00E9 }} -Compress\n{emit}\n"
    );
    let result = execute_script(ScriptParams {
        code: &code,
        shell: "powershell",
        args: &[],
        timeout_secs: 60,
        privilege: Privilege::Agent,
        env_vars: &[],
    })
    .await;

    assert_eq!(result.retcode, 0, "stderr: {}", result.stderr);
    let row: Row = serde_json::from_str(result.stdout.trim()).unwrap();
    assert_eq!(row.installed.as_deref(), Some("1.0-Дé"));
}
