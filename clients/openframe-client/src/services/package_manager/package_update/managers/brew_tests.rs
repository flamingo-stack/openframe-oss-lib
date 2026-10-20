use super::*;

/// `brew outdated --json=v2` shape, as captured on macOS 2026-10-05 (parent design).
const CAPTURED: &str = r#"{"formulae":[{"name":"c-ares","installed_versions":["1.34.5"],"current_version":"1.34.8","pinned":false,"pinned_version":null}],
 "casks":[{"name":"claude-code","installed_versions":["2.1.92"],"current_version":"2.1.285"}]}"#;

fn exited(retcode: i32, stderr: &str) -> ExecResult {
    ExecResult {
        stdout: String::new(),
        stderr: stderr.to_string(),
        retcode,
        timed_out: false,
    }
}

#[test]
fn formulae_and_casks_keep_their_kind_and_versions() {
    assert_eq!(
        parse_outdated(CAPTURED).unwrap(),
        vec![
            OutdatedPackage {
                package: PackageRef::Brew {
                    kind: BrewKind::Formula,
                    name: "c-ares".to_string()
                },
                installed_version: Some("1.34.5".to_string()),
                available_version: Some("1.34.8".to_string()),
            },
            OutdatedPackage {
                package: PackageRef::Brew {
                    kind: BrewKind::Cask,
                    name: "claude-code".to_string()
                },
                installed_version: Some("2.1.92".to_string()),
                available_version: Some("2.1.285".to_string()),
            },
        ]
    );
}

#[test]
fn a_leading_banner_is_skipped() {
    let output = format!("==> Auto-updating Homebrew...\n{CAPTURED}");
    assert_eq!(parse_outdated(&output).unwrap().len(), 2);
}

#[test]
fn nothing_outdated_is_an_empty_list() {
    assert_eq!(
        parse_outdated(r#"{"formulae":[],"casks":[]}"#).unwrap(),
        vec![]
    );
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
