use super::*;
use crate::services::package_manager::update_gate::MainImages;
use std::path::PathBuf;

/// Identity script output from Windows 11 with choco 2.7.4; shortcuts trimmed to these packages.
const CAPTURED: &str = r#"{
  "shortcuts": [
    { "target": "C:\\Program Files\\7-Zip\\7zFM.exe", "arguments": "" },
    { "target": "C:\\Program Files\\7-Zip\\7-zip.chm", "arguments": "" },
    { "target": "C:\\Program Files\\Git\\git-bash.exe", "arguments": "--cd-to-home" },
    { "target": "C:\\Program Files\\Git\\git-cmd.exe", "arguments": "--cd-to-home" },
    { "target": "C:\\Program Files\\Git\\cmd\\git-gui.exe", "arguments": "" },
    { "target": "C:\\Program Files\\Git\\ReleaseNotes.html", "arguments": "" }
  ],
  "packages": [
    { "id": "7zip", "installed": true, "lib": "C:\\ProgramData\\chocolatey\\lib",
      "deployments": ["C:\\ProgramData\\chocolatey\\lib\\7zip", "C:\\Program Files\\7-Zip\\"], "hasRegistry": true,
      "uninstallCommand": "\"C:\\Program Files\\7-Zip\\Uninstall.exe\"", "arpInstallLocation": "C:\\Program Files\\7-Zip\\",
      "arpDisplayIcon": "C:\\Program Files\\7-Zip\\7zFM.exe", "msiShortcutTargets": [], "msiShortcutErrors": [] },
    { "id": "git", "installed": true, "lib": "C:\\ProgramData\\chocolatey\\lib",
      "deployments": ["C:\\ProgramData\\chocolatey\\lib\\git", "C:\\Program Files\\Git\\"], "hasRegistry": true,
      "uninstallCommand": "\"C:\\Program Files\\Git\\unins001.exe\"", "arpInstallLocation": "C:\\Program Files\\Git\\",
      "arpDisplayIcon": "C:\\Program Files\\Git\\mingw64\\share\\git\\git-for-windows.ico",
      "msiShortcutTargets": [], "msiShortcutErrors": [] },
    { "id": "ripgrep", "installed": true, "lib": "C:\\ProgramData\\chocolatey\\lib",
      "deployments": ["C:\\ProgramData\\chocolatey\\lib\\ripgrep\\tools"], "hasRegistry": false,
      "uninstallCommand": "", "arpInstallLocation": "", "arpDisplayIcon": "", "msiShortcutTargets": [], "msiShortcutErrors": [] },
    { "id": "nosuchpkg", "installed": false }
  ]
}"#;

fn captured(id: &str) -> Result<AppIdentity, Undetermined> {
    let output: Output = serde_json::from_str(CAPTURED).unwrap();
    let found = output
        .packages
        .into_iter()
        .find(|found| found.id == id)
        .unwrap();
    identity(&package(found), &output.shortcuts)
}

fn app(dir: &str, names: &[&str]) -> Result<AppIdentity, Undetermined> {
    Ok(AppIdentity::App {
        install_dir: PathBuf::from(dir),
        main_images: MainImages::Derived(names.iter().map(|n| n.to_string()).collect()),
    })
}

#[test]
fn a_meta_package_resolves_to_the_app_its_dependency_installed() {
    assert_eq!(
        captured("7zip"),
        app(r"C:\Program Files\7-Zip\", &["7zfm.exe"])
    );
    assert_eq!(
        captured("git"),
        app(
            r"C:\Program Files\Git\",
            &["git-bash.exe", "git-cmd.exe", "git-gui.exe"]
        )
    );
}

#[test]
fn a_portable_package_resolves_to_its_lib_folder() {
    assert_eq!(
        captured("ripgrep"),
        Ok(AppIdentity::App {
            install_dir: PathBuf::from(r"C:\ProgramData\chocolatey\lib\ripgrep\tools"),
            main_images: MainImages::Unknown,
        })
    );
}

#[test]
fn a_package_missing_from_lib_is_not_installed() {
    assert_eq!(captured("nosuchpkg"), Err(Undetermined::NotInstalled));
}

#[test]
fn a_lib_folder_is_not_the_app_when_an_uninstall_key_exists() {
    let found = Found {
        id: "vlc".to_string(),
        installed: true,
        lib: r"C:\ProgramData\chocolatey\lib".to_string(),
        deployments: vec![r"C:\ProgramData\chocolatey\lib\vlc".to_string()],
        has_registry: true,
        uninstall_command: None,
        arp_install_location: Some(r"C:\Program Files\VideoLAN\VLC".to_string()),
        arp_display_icon: Some(r"C:\Program Files\VideoLAN\VLC\vlc.exe,0".to_string()),
        msi_shortcut_targets: Vec::new(),
        msi_shortcut_errors: Vec::new(),
    };
    assert_eq!(
        identity(&package(found), &[]),
        app(r"C:\Program Files\VideoLAN\VLC", &["vlc.exe"])
    );
}
