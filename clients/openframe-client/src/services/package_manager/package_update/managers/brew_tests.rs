use super::*;

/// `brew info --json=v2` output trimmed to the fields read, Homebrew 7.0.9 on macOS, 2026-10-28.
const CASKS: &str = r#"{"formulae": [], "casks": [{"token": "docker-desktop", "installed": "4.52.0,210994", "version": "4.97.0,244584", "outdated": true}, {"token": "visual-studio-code", "installed": "1.137.0", "version": "1.143.1", "outdated": false}, {"token": "zoom", "installed": null, "version": "7.2.2.88465", "outdated": false}]}"#;
const FORMULAE: &str = r#"{"formulae": [{"name": "fzf", "installed": [{"version": "0.74.5"}], "versions": {"stable": "0.74.5"}, "outdated": false, "pinned": false}, {"name": "go", "installed": [{"version": "1.26.0"}], "versions": {"stable": "1.27.3"}, "outdated": true, "pinned": false}], "casks": []}"#;

/// The captured output reduced to its `index`-th entry, as `brew info` prints it for one package.
fn one(captured: &str, list: &str, index: usize) -> String {
    let mut info: serde_json::Value = serde_json::from_str(captured).unwrap();
    let entry = info[list][index].take();
    info[list] = serde_json::json!([entry]);
    info.to_string()
}

fn probe(state: ProbeState, installed: Option<&str>, available: &str) -> Probe {
    Probe {
        state,
        installed_version: installed.map(str::to_string),
        available_version: Some(available.to_string()),
    }
}

fn exited(retcode: i32, stderr: &str) -> ExecResult {
    ExecResult {
        stdout: String::new(),
        stderr: stderr.to_string(),
        retcode,
        timed_out: false,
    }
}

#[test]
fn a_cask_is_outdated_up_to_date_or_not_installed() {
    assert_eq!(
        read_info(&one(CASKS, "casks", 0)).unwrap(),
        probe(ProbeState::Outdated, Some("4.52.0,210994"), "4.97.0,244584")
    );
    assert_eq!(
        read_info(&one(CASKS, "casks", 1)).unwrap(),
        probe(ProbeState::UpToDate, Some("1.137.0"), "1.143.1"),
        "an auto-updating app brew sees as current is not re-installed"
    );
    assert_eq!(
        read_info(&one(CASKS, "casks", 2)).unwrap(),
        probe(ProbeState::NotInstalled, None, "7.2.2.88465")
    );
}

#[test]
fn a_formula_is_outdated_up_to_date_or_not_installed() {
    assert_eq!(
        read_info(&one(FORMULAE, "formulae", 0)).unwrap(),
        probe(ProbeState::UpToDate, Some("0.74.5"), "0.74.5")
    );
    assert_eq!(
        read_info(&one(FORMULAE, "formulae", 1)).unwrap(),
        probe(ProbeState::Outdated, Some("1.26.0"), "1.27.3")
    );
    let missing = one(FORMULAE, "formulae", 1).replace(r#"[{"version":"1.26.0"}]"#, "[]");
    assert_eq!(read_info(&missing).unwrap().state, ProbeState::NotInstalled);
}

#[test]
fn a_pinned_outdated_formula_is_not_upgradable() {
    let pinned = one(FORMULAE, "formulae", 1).replace(r#""pinned":false"#, r#""pinned":true"#);

    assert!(matches!(
        read_info(&pinned).unwrap().state,
        ProbeState::NotUpgradable(_)
    ));
}

#[test]
fn a_pinned_or_disabled_outdated_package_is_not_upgradable() {
    let cases = [
        one(CASKS, "casks", 0).replace(r#""outdated":true"#, r#""outdated":true,"pinned":true"#),
        one(CASKS, "casks", 0).replace(r#""outdated":true"#, r#""outdated":true,"disabled":true"#),
        one(FORMULAE, "formulae", 1)
            .replace(r#""pinned":false"#, r#""pinned":false,"disabled":true"#),
    ];

    for info in &cases {
        assert!(
            matches!(read_info(info).unwrap().state, ProbeState::NotUpgradable(_)),
            "{info}"
        );
    }
}

#[test]
fn a_leading_banner_is_skipped() {
    let output = format!("==> Auto-updating Homebrew...\n{}", one(CASKS, "casks", 0));
    assert_eq!(read_info(&output).unwrap().state, ProbeState::Outdated);
}

#[test]
fn output_naming_no_package_is_an_error() {
    assert!(read_info(r#"{"formulae":[],"casks":[]}"#).is_err());
}

#[test]
fn a_cask_brew_skipped_is_not_reported_as_upgraded() {
    let cases = [
        (
            "Warning: Not upgrading postman, the latest version is already installed\n",
            UpgradeOutcome::AlreadyLatest,
        ),
        (
            "Warning: Not upgrading postman, the downloaded artifact has not changed\n",
            UpgradeOutcome::AlreadyLatest,
        ),
        (
            "Warning: Not upgrading postman, it is disabled because it is discontinued upstream!\n",
            UpgradeOutcome::NotUpgradable(
                "Not upgrading postman, it is disabled because it is discontinued upstream!"
                    .to_string(),
            ),
        ),
        (
            "Warning: Not upgrading postman, no version is available for the current platform\n",
            UpgradeOutcome::NotUpgradable(
                "Not upgrading postman, no version is available for the current platform"
                    .to_string(),
            ),
        ),
    ];

    for (stderr, expected) in cases {
        assert_eq!(interpret(&exited(0, stderr)), expected, "{stderr}");
    }
}

#[test]
fn exit_codes_map_to_outcomes() {
    assert_eq!(
        interpret(&exited(0, "")),
        UpgradeOutcome::Upgraded {
            reboot_required: false
        }
    );
    assert!(matches!(
        interpret(&exited(85, "no console user")),
        UpgradeOutcome::Busy(_)
    ));
    assert_eq!(
        interpret(&exited(0, "Warning: postman 11.2.0 already installed\n")),
        UpgradeOutcome::AlreadyLatest
    );
    assert_eq!(
        interpret(&ExecResult {
            stdout: "==> Upgrading postman\n  11.1.0 -> 11.2.0\n".to_string(),
            ..exited(0, "Warning: node 20.1.0 already installed\n")
        }),
        UpgradeOutcome::Upgraded {
            reboot_required: false
        }
    );
    assert_eq!(
        interpret(&exited(1, "Error: Cask 'x' is not installed.\n")),
        UpgradeOutcome::Failed {
            exit_code: 1,
            message: "brew exited 1: Error: Cask 'x' is not installed.".to_string()
        }
    );
    assert_eq!(
        interpret(&ExecResult {
            timed_out: true,
            ..exited(0, "")
        }),
        UpgradeOutcome::TimedOut
    );
}
