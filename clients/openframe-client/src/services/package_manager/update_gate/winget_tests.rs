use super::*;

/// The identity script's output, captured on Windows 10 2026-10-15 for these ids;
/// shortcuts trimmed to the ones under these packages, the profile path anonymised.
const CAPTURED: &str = r#"{
  "shortcuts": [
    { "target": "C:\\Program Files\\DB Browser for SQLite\\DB Browser for SQLCipher.exe", "arguments": "" },
    { "target": "C:\\Program Files\\DB Browser for SQLite\\DB Browser for SQLite.exe", "arguments": "" },
    { "target": "C:\\Program Files\\Notepad++\\notepad++.exe", "arguments": "" },
    { "target": "C:\\Program Files\\7-Zip\\7zFM.exe", "arguments": "" },
    { "target": "C:\\Program Files\\7-Zip\\7-zip.chm", "arguments": "" },
    { "target": "C:\\Program Files\\Greenshot\\Greenshot.exe", "arguments": "" },
    { "target": "C:\\Program Files\\Greenshot\\license.txt", "arguments": "" },
    { "target": "C:\\Program Files\\Greenshot\\readme.txt", "arguments": "" },
    { "target": "C:\\Program Files\\Greenshot\\unins000.exe", "arguments": "" },
    { "target": "D:\\Apps\\Obsidian\\Obsidian.exe", "arguments": "" },
    { "target": "C:\\Users\\user\\AppData\\Local\\GitHubDesktop\\GitHubDesktop.exe", "arguments": "" }
  ],
  "packages": [
    { "id": "Notepad++.Notepad++", "installed": true,
      "uninstallCommand": "\"C:\\Program Files\\Notepad++\\uninstall.exe\"", "appxApplications": [],
      "arpInstallLocation": "", "installedLocation": "", "arpDisplayIcon": "C:\\Program Files\\Notepad++\\notepad++.exe" },
    { "id": "Obsidian.Obsidian", "installed": true,
      "uninstallCommand": "\"D:\\Apps\\Obsidian\\Uninstall Obsidian.exe\" /currentuser", "appxApplications": [],
      "arpInstallLocation": "", "installedLocation": "", "arpDisplayIcon": "D:\\Apps\\Obsidian\\Obsidian.exe,0" },
    { "id": "SlackTechnologies.Slack", "installed": true, "uninstallCommand": "",
      "appxApplications": [ { "executable": "app\\Slack.exe", "appListEntry": "" } ],
      "arpInstallLocation": "",
      "installedLocation": "C:\\Program Files\\WindowsApps\\com.tinyspeck.slackdesktop_4.49.81.0_x64__8yrtsj140pw4g",
      "arpDisplayIcon": "" },
    { "id": "GitHub.GitHubDesktop", "installed": true,
      "uninstallCommand": "\"C:\\Users\\user\\AppData\\Local\\GitHubDesktop\\Update.exe\" --uninstall", "appxApplications": [],
      "arpInstallLocation": "C:\\Users\\user\\AppData\\Local\\GitHubDesktop",
      "installedLocation": "C:\\Users\\user\\AppData\\Local\\GitHubDesktop",
      "arpDisplayIcon": "C:\\Users\\user\\AppData\\Local\\GitHubDesktop\\app.ico" },
    { "id": "Greenshot.Greenshot", "installed": true,
      "uninstallCommand": "\"C:\\Program Files\\Greenshot\\unins000.exe\"", "appxApplications": [],
      "arpInstallLocation": "C:\\Program Files\\Greenshot\\", "installedLocation": "C:\\Program Files\\Greenshot\\",
      "arpDisplayIcon": "C:\\Program Files\\Greenshot\\Greenshot.exe" },
    { "id": "7zip.7zip", "installed": true,
      "uninstallCommand": "\"C:\\Program Files\\7-Zip\\Uninstall.exe\"", "appxApplications": [],
      "arpInstallLocation": "C:\\Program Files\\7-Zip\\", "installedLocation": "C:\\Program Files\\7-Zip\\",
      "arpDisplayIcon": "C:\\Program Files\\7-Zip\\7zFM.exe" },
    { "id": "DBBrowserForSQLite.DBBrowserForSQLite", "installed": true,
      "uninstallCommand": "MsiExec.exe /I{541AE182-7C1D-426C-8155-4867303B75A4}", "appxApplications": [],
      "arpInstallLocation": "C:\\Program Files\\DB Browser for SQLite\\",
      "installedLocation": "C:\\Program Files\\DB Browser for SQLite\\", "arpDisplayIcon": "" },
    { "id": "Microsoft.VCRedist.2015+.x64", "installed": true,
      "uninstallCommand": "\"C:\\ProgramData\\Package Cache\\{0e3bb569-69d6-4c34-bff9-c2f81db5e5f0}\\VC_redist.x64.exe\"  /uninstall",
      "appxApplications": [], "arpInstallLocation": "", "installedLocation": "",
      "arpDisplayIcon": "C:\\ProgramData\\Package Cache\\{0e3bb569-69d6-4c34-bff9-c2f81db5e5f0}\\VC_redist.x64.exe,0" },
    { "id": "Anthropic.Claude", "installed": true, "uninstallCommand": "",
      "appxApplications": [
        { "executable": "app\\Claude.exe", "appListEntry": "" },
        { "executable": "app\\resources\\claude-ssh-askpass.exe", "appListEntry": "none" },
        { "executable": "app\\resources\\claude-ssh-proxy.exe", "appListEntry": "none" }
      ],
      "arpInstallLocation": "", "installedLocation": "C:\\Program Files\\WindowsApps\\Claude_2.37337.1.0_x64__pzs8sxrjxfjjc",
      "arpDisplayIcon": "" },
    { "id": "Nonexistent.Package", "installed": false }
  ]
}"#;

fn app(dir: &str, names: &[&str]) -> Result<AppIdentity, Undetermined> {
    Ok(AppIdentity::App {
        install_dir: PathBuf::from(dir),
        main_images: MainImages::Derived(names.iter().map(|n| n.to_string()).collect()),
    })
}

#[test]
fn captured_packages_resolve_to_their_app() {
    let output: Output = serde_json::from_str(CAPTURED).expect("captured output parses");
    let expected: &[(&str, Result<AppIdentity, Undetermined>)] = &[
        (
            "Notepad++.Notepad++",
            app(r"C:\Program Files\Notepad++", &["notepad++.exe"]),
        ),
        (
            "Obsidian.Obsidian",
            app(r"D:\Apps\Obsidian", &["obsidian.exe"]),
        ),
        (
            "SlackTechnologies.Slack",
            app(
                r"C:\Program Files\WindowsApps\com.tinyspeck.slackdesktop_4.49.81.0_x64__8yrtsj140pw4g",
                &["slack.exe"],
            ),
        ),
        (
            "GitHub.GitHubDesktop",
            app(
                r"C:\Users\user\AppData\Local\GitHubDesktop",
                &["githubdesktop.exe"],
            ),
        ),
        (
            "Greenshot.Greenshot",
            app(r"C:\Program Files\Greenshot\", &["greenshot.exe"]),
        ),
        ("7zip.7zip", app(r"C:\Program Files\7-Zip\", &["7zfm.exe"])),
        (
            "DBBrowserForSQLite.DBBrowserForSQLite",
            app(
                r"C:\Program Files\DB Browser for SQLite\",
                &["db browser for sqlcipher.exe", "db browser for sqlite.exe"],
            ),
        ),
        (
            "Microsoft.VCRedist.2015+.x64",
            Err(Undetermined::NoInstallLocation),
        ),
        (
            "Anthropic.Claude",
            app(
                r"C:\Program Files\WindowsApps\Claude_2.37337.1.0_x64__pzs8sxrjxfjjc",
                &["claude.exe"],
            ),
        ),
        ("Nonexistent.Package", Err(Undetermined::NotInstalled)),
    ];

    assert_eq!(output.packages.len(), expected.len());
    for (package, (id, want)) in output.packages.iter().zip(expected) {
        assert_eq!(package.id, *id);
        assert_eq!(&identity(package, &output.shortcuts), want, "{id}");
    }
}

#[test]
fn missing_install_dir_without_any_source() {
    let package: Package = serde_json::from_str(r#"{ "id": "X", "installed": true }"#).unwrap();
    assert_eq!(
        identity(&package, &[]),
        Err(Undetermined::NoInstallLocation)
    );
}

#[test]
fn install_dir_without_any_main_image_is_unknown() {
    let package: Package = serde_json::from_str(
        r#"{ "id": "X", "installed": true, "installedLocation": "C:\\Program Files\\X" }"#,
    )
    .unwrap();
    assert_eq!(
        identity(&package, &[]),
        Ok(AppIdentity::App {
            install_dir: PathBuf::from(r"C:\Program Files\X"),
            main_images: MainImages::Unknown,
        })
    );
}

#[test]
fn command_image_edges() {
    let cases: &[(&str, Option<&str>)] = &[
        (
            r#""C:\Program Files\A\uninstall.exe" /S"#,
            Some(r"C:\Program Files\A\uninstall.exe"),
        ),
        (r"C:\A\app.exe,0", Some(r"C:\A\app.exe")),
        (
            r"C:\Program Files\A\un ins.exe /x",
            Some(r"C:\Program Files\A\un ins.exe"),
        ),
        (r"C:\A\APP.EXE", Some(r"C:\A\APP.EXE")),
        (
            r"MsiExec.exe /I{541AE182-7C1D-426C-8155-4867303B75A4}",
            None,
        ),
        (r"C:\A\app.ico", None),
        ("", None),
    ];
    for (command, expected) in cases {
        assert_eq!(
            command_image(command),
            expected.map(PathBuf::from),
            "{command}"
        );
    }
}

#[test]
fn is_app_dir_rejects_shared_locations() {
    let cases: &[(&str, bool)] = &[
        (r"C:\Program Files\App", true),
        (r"D:\Apps\Obsidian", true),
        (r"C:\Users\user\AppData\Local\GitHubDesktop", true),
        (r"C:\Program Files\App\", true),
        ("", false),
        (r"C:\", false),
        (r"C:\Program Files", false),
        (r"C:\Program Files (x86)\", false),
        (r"D:\Program Files", false),
        (r"C:\ProgramData", false),
        (r"C:\Windows", false),
        (r"C:\Windows\System32", false),
        (r"C:\Users", false),
        (r"C:\Users\user\AppData\Local", false),
        (r"C:\Users\user\AppData\Roaming", false),
        (r"C:\Users\user\AppData\Local\Programs", false),
        (r"C:\Windows\Installer\{GUID}", false),
        (r"C:\ProgramData\Package Cache\{GUID}", false),
    ];
    for (dir, expected) in cases {
        assert_eq!(is_app_dir(Path::new(dir)), *expected, "{dir}");
    }
}

#[test]
fn shortcut_image_edges() {
    let dir = Path::new(r"C:\Users\user\AppData\Local\Slack");
    let shortcut = |target: &str, arguments: &str| Shortcut {
        target: target.to_string(),
        arguments: arguments.to_string(),
    };
    let cases: &[(Shortcut, Option<&str>)] = &[
        (
            shortcut(r"C:\Users\user\AppData\Local\Slack\slack.exe", ""),
            Some("slack.exe"),
        ),
        (
            shortcut(
                r"C:\Users\user\AppData\Local\Slack\Update.exe",
                r#"--processStart "slack.exe""#,
            ),
            Some("slack.exe"),
        ),
        (
            shortcut(
                r"C:\Users\user\AppData\Local\Slack\Update.exe",
                "--processStart Slack.exe --process-start-args x",
            ),
            Some("slack.exe"),
        ),
        (
            shortcut(
                r"C:\Users\user\AppData\Local\Slack\Update.exe",
                "--uninstall",
            ),
            None,
        ),
        (
            shortcut(r"C:\Users\user\AppData\Local\Slack\readme.txt", ""),
            None,
        ),
        (shortcut(r"C:\Program Files\Other\slack.exe", ""), None),
    ];
    for (shortcut, expected) in cases {
        assert_eq!(
            shortcut_image(shortcut, dir),
            expected.map(str::to_string),
            "{} {}",
            shortcut.target,
            shortcut.arguments
        );
    }
}
