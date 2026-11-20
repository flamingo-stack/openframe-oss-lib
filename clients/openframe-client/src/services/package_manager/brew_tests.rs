use super::*;

#[test]
fn a_cask_is_found_by_its_old_token_or_its_tap_qualified_name() {
    let info: CaskInfo = serde_json::from_str(
        r#"{"casks": [{"token": "docker-desktop", "full_token": "docker-desktop", "old_tokens": ["docker"], "installed": "4.52.0,210994"},
                      {"token": "fork", "full_token": "acme/apps/fork", "installed": "2.59.2"}]}"#,
    )
    .unwrap();
    let cases = [
        ("docker-desktop", Some("docker-desktop")),
        ("docker", Some("docker-desktop")),
        ("homebrew/cask/docker", Some("docker-desktop")),
        ("acme/apps/fork", Some("fork")),
        ("docker-desktop-beta", None),
    ];

    for (name, expected) in cases {
        let found = info.casks.iter().find(|cask| cask.is_named(name));
        assert_eq!(found.map(|cask| cask.token.as_str()), expected, "{name}");
    }
}

#[test]
fn the_app_goes_where_the_artifacts_say_whether_installed_or_not() {
    let info: CaskInfo = serde_json::from_str(
        r#"{"casks": [
 {"token": "klogg", "installed": "22.06.0.1289", "artifacts": [
   {"app": ["klogg.app"], "target": "/Applications/klogg.app"},
   {"zap": [{"trash": ["~/Library/Application Support/klogg"]}]}]},
 {"token": "postman", "installed": null, "artifacts": [
   {"app": ["Postman.app"], "target": "/Applications/Postman.app"}]},
 {"token": "fork", "installed": "2.59.2", "artifacts": [{"app": ["Fork.app"]}]},
 {"token": "claude-code", "installed": "2.1.92", "artifacts": [
   {"binary": ["claude"], "target": "/opt/homebrew/bin/claude"}]},
 {"token": "zoom", "installed": null, "artifacts": [
   {"uninstall": [{"pkgutil": "us.zoom.pkg.videomeeting", "delete": ["/Applications/zoom.us.app"]}]},
   {"pkg": ["zoomusInstallerFull.pkg"]}]},
 {"token": "gcloud-cli", "installed": null, "artifacts": [
   {"installer": [{"script": {"executable": "google-cloud-sdk/install.sh", "args": ["--quiet"]}}]},
   {"binary": ["google-cloud-sdk/bin/gcloud"], "target": "/opt/homebrew/bin/gcloud"}]},
 {"token": "broken", "installed": null, "artifacts": [{"app": []}]}
]}"#,
    )
    .unwrap();
    let applications = Path::new("/Apps");
    let cases = [
        (
            "klogg",
            CaskApp::Bundle(PathBuf::from("/Applications/klogg.app")),
        ),
        (
            "postman",
            CaskApp::Bundle(PathBuf::from("/Applications/Postman.app")),
        ),
        ("fork", CaskApp::Bundle(PathBuf::from("/Apps/Fork.app"))),
        ("claude-code", CaskApp::NoApp),
        ("zoom", CaskApp::Unknown),
        ("gcloud-cli", CaskApp::Unknown),
        ("broken", CaskApp::Unknown),
    ];

    for (token, expected) in cases {
        let cask = info.casks.iter().find(|cask| cask.token == token).unwrap();
        assert_eq!(cask.app(applications), expected, "{token}");
    }
}

#[test]
fn brew_info_output_parses_past_warnings_and_fails_without_json() {
    let warned = CaskInfo::from_output(
        "Warning: Treating firefox as a cask.
{\"casks\": [{\"token\": \"firefox\", \"installed\": null}]}",
    )
    .unwrap();

    assert!(warned.casks[0].is_named("firefox"));
    for output in [
        "",
        "Error: No available cask with the name \"firefox\".",
        "{\"casks\": [",
        "{\"formulae\": []}",
    ] {
        assert!(CaskInfo::from_output(output).is_err(), "{output:?}");
    }
}
