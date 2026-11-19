use super::*;
use plist::{Dictionary, Value};
use serde_json::json;

const FIREFOX: &str = "org.mozilla.firefox";

fn app_with_id(dir: &Path, id: &str) -> PathBuf {
    let app = dir.join("Firefox.app");
    std::fs::create_dir_all(app.join("Contents")).unwrap();
    let mut info = Dictionary::new();
    info.insert("CFBundleIdentifier".to_string(), Value::String(id.into()));
    Value::Dictionary(info)
        .to_file_xml(app.join("Contents").join("Info.plist"))
        .unwrap();
    app
}

fn cask(installed: Option<&str>, artifacts: serde_json::Value) -> Cask {
    serde_json::from_value(json!({
        "token": "firefox",
        "installed": installed,
        "artifacts": artifacts,
    }))
    .unwrap()
}

fn app_cask(installed: Option<&str>, target: &Path) -> Cask {
    cask(
        installed,
        json!([{"app": ["Firefox.app"], "target": target}, {"zap": [{"trash": ["~/.mozilla"]}]}]),
    )
}

fn refused(planned: Result<Plan<'_>, Refusal>) -> AdoptFailReason {
    match planned {
        Err(refusal) => refusal.reason,
        Ok(_) => panic!("planned an install"),
    }
}

#[test]
fn a_cask_brew_manages_already_needs_no_identity() {
    let planned = plan(
        &app_cask(Some("145.0.1"), Path::new("/Applications/Firefox.app")),
        None,
        Path::new("/Applications"),
    );

    assert!(matches!(planned, Ok(Plan::AlreadyManaged)));
}

#[test]
fn an_install_is_refused_before_anything_changes() {
    let dir = tempfile::tempdir().unwrap();
    let firefox = app_with_id(dir.path(), FIREFOX);
    let other = app_with_id(&dir.path().join("other"), "com.example.other");
    let unreadable = dir.path().join("broken").join("Firefox.app");
    std::fs::create_dir_all(unreadable.join("Contents")).unwrap();
    std::fs::write(unreadable.join("Contents").join("Info.plist"), b"bplist00").unwrap();
    let applications = Path::new("/Applications");
    let cases = [
        (
            "no bundle id in the order",
            app_cask(None, &firefox),
            None,
            AdoptFailReason::IdentityUnknown,
        ),
        (
            "a pkg cask",
            cask(
                None,
                json!([{"pkg": ["Firefox.pkg"]}, {"app": ["Firefox.app"], "target": &firefox}]),
            ),
            Some(FIREFOX),
            AdoptFailReason::NeedsAdmin,
        ),
        (
            "a binary-only cask",
            cask(
                None,
                json!([{"binary": ["firefox"], "target": "/opt/homebrew/bin/firefox"}]),
            ),
            Some(FIREFOX),
            AdoptFailReason::NotSupported,
        ),
        (
            "an installer cask",
            cask(
                None,
                json!([{"installer": [{"script": {"executable": "install.sh"}}]}]),
            ),
            Some(FIREFOX),
            AdoptFailReason::NotSupported,
        ),
        (
            "no app where the cask installs it",
            app_cask(None, &dir.path().join("Missing.app")),
            Some(FIREFOX),
            AdoptFailReason::NotFound,
        ),
        (
            "an app whose Info.plist cannot be read",
            app_cask(None, &unreadable),
            Some(FIREFOX),
            AdoptFailReason::IdentityUnknown,
        ),
        (
            "another app at the cask's path",
            app_cask(None, &other),
            Some(FIREFOX),
            AdoptFailReason::IdentityMismatch,
        ),
    ];

    for (case, cask, bundle_id, expected) in cases {
        assert_eq!(
            refused(plan(&cask, bundle_id, applications)),
            expected,
            "{case}"
        );
    }
}

#[test]
fn the_app_the_order_names_is_installed_over_whatever_the_case_of_its_id() {
    let dir = tempfile::tempdir().unwrap();
    let firefox = app_with_id(dir.path(), FIREFOX);

    match plan(
        &app_cask(None, &firefox),
        Some("org.Mozilla.Firefox"),
        Path::new("/Applications"),
    ) {
        Ok(Plan::Install { app, bundle_id }) => {
            assert_eq!(app, firefox);
            assert_eq!(bundle_id, "org.Mozilla.Firefox");
        }
        _ => panic!("expected an install"),
    }
}

#[test]
fn an_install_counts_only_once_brew_manages_the_same_app() {
    let dir = tempfile::tempdir().unwrap();
    let firefox = app_with_id(dir.path(), FIREFOX);
    let other = app_with_id(&dir.path().join("other"), "com.example.other");
    let cases = [
        (
            "managed, same app",
            app_cask(Some("145.0.1"), &firefox),
            &firefox,
            Ok(AdoptOutcome::Reinstalled),
        ),
        (
            "not listed as installed",
            app_cask(None, &firefox),
            &firefox,
            Err(AdoptFailReason::ManagerError),
        ),
        (
            "managed, but another app at the path",
            app_cask(Some("145.0.1"), &other),
            &other,
            Err(AdoptFailReason::IdentityMismatch),
        ),
    ];

    for (case, cask, app, expected) in cases {
        let verified = verify(&cask, app, FIREFOX, AdoptOutcome::Reinstalled)
            .map_err(|refusal| refusal.reason);
        assert_eq!(verified, expected, "{case}");
    }
}
