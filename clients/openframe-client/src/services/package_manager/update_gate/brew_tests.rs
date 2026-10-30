use super::*;

/// Homebrew 7.0.9 cask info, trimmed; zoom's installed field set by hand, fork pre-target shape.
const CAPTURED: &str = r#"{"casks": [
 {"token": "klogg", "installed": "22.06.0.1289", "artifacts": [
   {"app": ["klogg.app"], "target": "/Applications/klogg.app"},
   {"command_wrapper": ["klogg", {"executable": "/Applications/klogg.app/Contents/MacOS/klogg"}], "target": "/opt/homebrew/bin/klogg"},
   {"zap": [{"trash": ["~/Library/Application Support/klogg"]}]}]},
 {"token": "visual-studio-code", "installed": "1.137.0", "artifacts": [
   {"uninstall": [{"launchctl": "com.microsoft.VSCode.ShipIt", "quit": "com.microsoft.VSCode"}]},
   {"app": ["Visual Studio Code.app"], "target": "/Applications/Visual Studio Code.app"},
   {"binary": ["/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"], "target": "/opt/homebrew/bin/code"},
   {"zap": [{"trash": ["~/.vscode"]}]}]},
 {"token": "claude-code", "installed": "2.1.92", "artifacts": [
   {"binary": ["claude"], "target": "/opt/homebrew/bin/claude"},
   {"zap": [{"trash": ["~/.cache/claude"], "rmdir": "~/.claude"}]}]},
 {"token": "font-jetbrains-mono-nerd-font", "installed": "3.5.1", "artifacts": [
   {"font": ["JetBrainsMonoNLNerdFont-Bold.ttf"], "target": "/Users/user/Library/Fonts/JetBrainsMonoNLNerdFont-Bold.ttf"}]},
 {"token": "gcloud-cli", "installed": "548.0.0", "artifacts": [
   {"preflight_steps": [{"steps": [{"paths": [{"base": "staged_path", "path": "google-cloud-sdk"}], "recursive": true, "type": "remove"}]}]},
   {"uninstall": [{"trash": "/opt/homebrew/Caskroom/gcloud-cli/latest"}]},
   {"installer": [{"script": {"executable": "google-cloud-sdk/install.sh", "args": ["--quiet"]}}]},
   {"binary": ["google-cloud-sdk/bin/gcloud"], "target": "/opt/homebrew/bin/gcloud"}]},
 {"token": "zoom", "installed": "6.6.0", "artifacts": [
   {"uninstall": [{"pkgutil": "us.zoom.pkg.videomeeting", "delete": ["/Applications/zoom.us.app"]}]},
   {"pkg": ["zoomusInstallerFull.pkg"]},
   {"postflight_steps": [{"steps": [{"name": "/Applications/zoom.us.app", "type": "terminate_process"}]}]}]},
 {"token": "postman", "installed": null, "artifacts": [
   {"app": ["Postman.app"], "target": "/Applications/Postman.app"}]},
 {"token": "fork", "installed": "2.59.2", "artifacts": [{"app": ["Fork.app"]}]}
]}"#;

/// The identity's app location without its main images, which depend on the test machine.
fn located(identity: Result<AppIdentity, Undetermined>) -> Result<Option<PathBuf>, Undetermined> {
    identity.map(|identity| match identity {
        AppIdentity::NoApp => None,
        AppIdentity::App { install_dir, .. } => Some(install_dir),
    })
}

#[test]
fn a_cask_is_found_by_its_old_token_or_its_tap_qualified_name() {
    let info: Info = serde_json::from_str(
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
        let found = info.casks.iter().find(|cask| is_named(cask, name));
        assert_eq!(found.map(|cask| cask.token.as_str()), expected, "{name}");
    }
}

#[test]
fn the_artifacts_decide_where_the_app_is_or_that_there_is_none() {
    let info: Info = serde_json::from_str(CAPTURED).unwrap();
    let applications = Path::new("/Apps");
    let cases: &[(&str, Result<Option<&str>, Undetermined>)] = &[
        ("klogg", Ok(Some("/Applications/klogg.app"))),
        (
            "visual-studio-code",
            Ok(Some("/Applications/Visual Studio Code.app")),
        ),
        ("claude-code", Ok(None)),
        ("font-jetbrains-mono-nerd-font", Ok(None)),
        ("gcloud-cli", Err(Undetermined::NoInstallLocation)),
        ("zoom", Err(Undetermined::NoInstallLocation)),
        ("postman", Err(Undetermined::NotInstalled)),
        ("fork", Ok(Some("/Apps/Fork.app"))),
    ];

    for (token, expected) in cases {
        let cask = info.casks.iter().find(|c| c.token == *token).unwrap();
        assert_eq!(
            located(identity(cask, applications)),
            expected.clone().map(|dir| dir.map(PathBuf::from)),
            "{token}"
        );
    }
}

#[test]
fn main_images_are_the_files_directly_in_contents_macos() {
    let bundle = tempfile::tempdir().unwrap();
    let macos = bundle.path().join("Contents").join("MacOS");
    std::fs::create_dir_all(macos.join("Nested.app")).unwrap();
    std::fs::create_dir_all(bundle.path().join("Contents").join("Frameworks")).unwrap();
    for file in [
        macos.join("klogg"),
        macos.join("klogg_crashpad_handler"),
        bundle
            .path()
            .join("Contents")
            .join("Frameworks")
            .join("helper"),
    ] {
        std::fs::write(file, "").unwrap();
    }
    let cask = |target: &Path| Cask {
        token: "klogg".to_string(),
        full_token: "klogg".to_string(),
        old_tokens: Vec::new(),
        installed: Some("22.06.0.1289".to_string()),
        artifacts: vec![serde_json::from_value(serde_json::json!({
            "app": ["klogg.app"],
            "target": target,
        }))
        .unwrap()],
    };

    assert_eq!(
        identity(&cask(bundle.path()), Path::new(APPLICATIONS)),
        Ok(AppIdentity::App {
            install_dir: bundle.path().to_path_buf(),
            main_images: MainImages::Derived(vec![
                "klogg".to_string(),
                "klogg_crashpad_handler".to_string()
            ]),
        })
    );
    let missing = bundle.path().join("Missing.app");
    assert_eq!(
        identity(&cask(&missing), Path::new(APPLICATIONS)),
        Ok(AppIdentity::App {
            install_dir: missing,
            main_images: MainImages::Unknown,
        })
    );
}
