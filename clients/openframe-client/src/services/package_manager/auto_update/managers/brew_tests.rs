use super::*;

/// `brew outdated --json=v2` shape, as captured on macOS 2026-10-05 (parent design).
const CAPTURED: &str = r#"{"formulae":[{"name":"c-ares","installed_versions":["1.34.5"],"current_version":"1.34.8","pinned":false,"pinned_version":null}],
 "casks":[{"name":"claude-code","installed_versions":["2.1.92"],"current_version":"2.1.285"}]}"#;

#[test]
fn formulae_and_casks_keep_their_kind() {
    assert_eq!(
        parse_outdated(CAPTURED).unwrap(),
        vec![
            PackageRef::Brew {
                kind: BrewKind::Formula,
                name: "c-ares".to_string()
            },
            PackageRef::Brew {
                kind: BrewKind::Cask,
                name: "claude-code".to_string()
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
