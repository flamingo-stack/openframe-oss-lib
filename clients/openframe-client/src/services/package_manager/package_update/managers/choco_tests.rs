use super::*;

fn query(retcode: i32, stdout: &str) -> ExecResult {
    ExecResult {
        stdout: stdout.to_string(),
        stderr: String::new(),
        retcode,
        timed_out: false,
    }
}

fn probed(stdout: &str) -> Probe {
    read_probe(&query(0, stdout)).unwrap()
}

fn exited(retcode: i32) -> ExecResult {
    ExecResult {
        stdout: "Upgrading the following packages:\nvlc\nChocolatey upgraded 0/1 packages. 1 packages failed."
            .to_string(),
        stderr: String::new(),
        retcode,
        timed_out: false,
    }
}

#[test]
fn a_newer_feed_version_is_outdated_with_both_versions() {
    assert_eq!(
        probed(r#"{"installed":"7zip|26.3.0","upgrade":"7zip|26.3.0|26.6.0|false"}"#),
        Probe {
            state: ProbeState::Outdated,
            installed_version: Some("26.3.0".to_string()),
            available_version: Some("26.6.0".to_string()),
        }
    );
    assert_eq!(
        probed(r#"{"installed":"git|2.55.0.5","upgrade":"git|2.55.0.5|2.56.0.4|false"}"#).state,
        ProbeState::Outdated
    );
}

#[test]
fn the_same_version_is_up_to_date_however_it_is_written() {
    for upgrade in ["vlc|3.0.21|3.0.21|false", "vlc|3.0.21|3.0.21.0|false"] {
        let stdout = format!(r#"{{"installed":"vlc|3.0.21","upgrade":"{upgrade}"}}"#);
        assert_eq!(probed(&stdout).state, ProbeState::UpToDate, "{upgrade}");
    }
}

#[test]
fn a_pin_makes_an_outdated_package_not_upgradable() {
    let probe = probed(r#"{"installed":"vlc|3.0.20","upgrade":"vlc|3.0.20|3.0.21|true"}"#);
    assert!(matches!(probe.state, ProbeState::NotUpgradable(_)));
    assert_eq!(probe.available_version.as_deref(), Some("3.0.21"));
}

#[test]
fn a_package_the_feed_lacks_is_not_upgradable() {
    let probe = probed(r#"{"installed":"make|4.4.1","upgrade":"make|4.4.1|false"}"#);
    assert!(matches!(probe.state, ProbeState::NotUpgradable(_)));
    assert_eq!(probe.installed_version.as_deref(), Some("4.4.1"));
    assert_eq!(probe.available_version, None);
}

#[test]
fn no_installed_row_means_not_installed() {
    assert_eq!(
        probed(r#"{"installed":"","upgrade":""}"#),
        Probe {
            state: ProbeState::NotInstalled,
            installed_version: None,
            available_version: None,
        }
    );
}

#[test]
fn a_failed_or_garbled_query_is_a_failure() {
    for result in [
        query(4, ""),
        query(0, "not json"),
        query(0, r#"{"installed":"vlc|3.0.21","upgrade":""}"#),
    ] {
        assert!(matches!(read_probe(&result), Err(QueryError::Failed(_))));
    }
}

#[test]
fn nuget_versions_order_by_number_then_prerelease() {
    assert_eq!(version_order("1.2", "1.2.0.0"), Some(Ordering::Equal));
    assert_eq!(version_order("1.2.9", "1.10"), Some(Ordering::Less));
    assert_eq!(version_order("2.0.0-beta", "2.0.0"), Some(Ordering::Less));
    assert_eq!(
        version_order("2.0.0+build.5", "2.0.0"),
        Some(Ordering::Equal)
    );
    assert_eq!(version_order("2.55.0.5", "2.55.0"), Some(Ordering::Greater));
    assert_eq!(version_order("latest", "1.0"), None);
}

#[test]
fn exit_codes_map_to_outcomes() {
    let cases = [
        (
            0,
            UpgradeOutcome::Upgraded {
                reboot_required: false,
            },
        ),
        (
            3010,
            UpgradeOutcome::Upgraded {
                reboot_required: true,
            },
        ),
        (
            1641,
            UpgradeOutcome::Upgraded {
                reboot_required: true,
            },
        ),
        (2, UpgradeOutcome::AlreadyLatest),
        (350, UpgradeOutcome::Busy("a reboot is pending".to_string())),
        (
            1604,
            UpgradeOutcome::Busy("a reboot is pending".to_string()),
        ),
        (
            1618,
            UpgradeOutcome::Busy("another installation is in progress".to_string()),
        ),
    ];
    for (code, expected) in cases {
        assert_eq!(interpret(&exited(code)), expected, "exit {code}");
    }
}

#[test]
fn a_timeout_fails_whatever_the_exit_code() {
    let result = ExecResult {
        timed_out: true,
        ..exited(0)
    };
    assert_eq!(interpret(&result), UpgradeOutcome::TimedOut);
}

#[test]
fn a_failure_names_the_code_and_the_last_line() {
    assert_eq!(
        interpret(&exited(1)),
        UpgradeOutcome::Failed {
            exit_code: 1,
            message: "choco exited 1: Chocolatey upgraded 0/1 packages. 1 packages failed."
                .to_string(),
        }
    );
}

#[test]
fn only_choco_exe_counts_as_a_running_chocolatey() {
    assert!(is_choco(std::path::Path::new(
        r"C:\ProgramData\chocolatey\bin\CHOCO.EXE"
    )));
    assert!(!is_choco(std::path::Path::new(
        r"C:\ProgramData\chocolatey\bin\chocolatey-agent.exe"
    )));
}
