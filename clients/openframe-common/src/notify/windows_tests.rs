use std::time::{SystemTime, UNIX_EPOCH};

use super::*;
use crate::notify::toast::{Action, Activation, ButtonStyle, Hint, Input, Scenario, Toast};

fn unique(name: &str) -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    format!("openframe-notify-{name}-{}-{nanos}", std::process::id())
}

struct TestKey(String);

impl TestKey {
    fn new(name: &str) -> Self {
        TestKey(format!(r"Software\OpenFrameTests\{}", unique(name)))
    }

    fn value(&self, subkey: &str, name: &str) -> std::io::Result<String> {
        RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey(format!(r"{}\{subkey}", self.0))?
            .get_value(name)
    }

    fn app_id_value(&self, id: &str, name: &str) -> std::io::Result<String> {
        self.value(&format!(r"AppUserModelId\{id}"), name)
    }
}

impl Drop for TestKey {
    fn drop(&mut self) {
        let _ = RegKey::predef(HKEY_CURRENT_USER).delete_subkey_all(&self.0);
    }
}

struct TestDir(PathBuf);

impl TestDir {
    fn new(name: &str) -> Self {
        TestDir(std::env::temp_dir().join(unique(name)))
    }
}

impl Drop for TestDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

#[test]
fn register_app_id_writes_every_value_and_can_run_again() {
    let key = TestKey::new("app-id");
    let icon = Path::new(r"C:\Users\test\AppData\Local\com.openframe.console\logo.png");
    let app = AppId {
        id: "com.openframe.console",
        display_name: "OpenFrame Console",
        icon: Some(icon),
        icon_background: Some("#00000000"),
        custom_activator: Some("{0F4A7C3E-1B2D-4E5F-8A9B-C0D1E2F3A4B5}"),
    };

    for _ in 0..2 {
        register_app_id_in(&key.0, &app).unwrap();
        let value = |name| key.app_id_value(app.id, name).unwrap();
        assert_eq!(value("DisplayName"), "OpenFrame Console");
        assert_eq!(value("IconUri"), icon.display().to_string());
        assert_eq!(value("IconBackgroundColor"), "#00000000");
        assert_eq!(
            value("CustomActivator"),
            "{0F4A7C3E-1B2D-4E5F-8A9B-C0D1E2F3A4B5}"
        );
    }
}

#[test]
fn register_app_id_writes_only_the_values_it_is_given() {
    let key = TestKey::new("app-id-minimal");
    let app = AppId {
        id: "com.openframe.chat",
        display_name: "OpenFrame Chat",
        icon: None,
        icon_background: None,
        custom_activator: None,
    };

    register_app_id_in(&key.0, &app).unwrap();

    assert_eq!(
        key.app_id_value(app.id, "DisplayName").unwrap(),
        "OpenFrame Chat"
    );
    for name in ["IconUri", "IconBackgroundColor", "CustomActivator"] {
        assert!(
            key.app_id_value(app.id, name).is_err(),
            "{name} was written"
        );
    }
}

#[test]
fn register_url_scheme_points_the_command_at_the_latest_exe() {
    let key = TestKey::new("url-scheme");

    for exe in [
        r"C:\Program Files\OpenFrame\old\openframe-chat.exe",
        r"C:\Program Files\OpenFrame\openframe-chat.exe",
    ] {
        register_url_scheme_in(&key.0, "openframe-chat", "OpenFrame Chat", Path::new(exe)).unwrap();

        assert_eq!(
            key.value("openframe-chat", "").unwrap(),
            "URL:OpenFrame Chat"
        );
        assert_eq!(key.value("openframe-chat", "URL Protocol").unwrap(), "");
        assert_eq!(
            key.value(r"openframe-chat\shell\open\command", "").unwrap(),
            format!("\"{exe}\" \"%1\"")
        );
    }
}

#[test]
fn ensure_icon_creates_the_folder_and_writes_the_icon() {
    let dir = TestDir::new("icon-new");

    let path = ensure_icon(&dir.0, "logo.png", b"png-bytes").unwrap();

    assert_eq!(path, dir.0.join("logo.png"));
    assert_eq!(std::fs::read(&path).unwrap(), b"png-bytes");
}

#[test]
fn ensure_icon_leaves_an_identical_icon_untouched() {
    let dir = TestDir::new("icon-identical");
    std::fs::create_dir_all(&dir.0).unwrap();
    let path = dir.0.join("logo.png");
    std::fs::write(&path, b"png-bytes").unwrap();
    let mut permissions = std::fs::metadata(&path).unwrap().permissions();
    permissions.set_readonly(true);
    std::fs::set_permissions(&path, permissions.clone()).unwrap();

    let result = ensure_icon(&dir.0, "logo.png", b"png-bytes");

    #[allow(clippy::permissions_set_readonly_false)]
    permissions.set_readonly(false);
    std::fs::set_permissions(&path, permissions).unwrap();
    result.unwrap();
}

#[test]
fn ensure_icon_replaces_a_changed_icon_of_the_same_size() {
    let dir = TestDir::new("icon-changed");
    std::fs::create_dir_all(&dir.0).unwrap();
    let path = dir.0.join("logo.png");
    std::fs::write(&path, b"old-bytes").unwrap();

    ensure_icon(&dir.0, "logo.png", b"new-bytes").unwrap();

    assert_eq!(std::fs::read(&path).unwrap(), b"new-bytes");
    assert_eq!(std::fs::read_dir(&dir.0).unwrap().count(), 1);
}

#[test]
fn windows_parses_a_toast_that_uses_every_element() {
    let toast = Toast {
        launch: "openframe-console://notify?payload=%7B%7D&x=<1>",
        title: "Approve \"Restart\" & 'go'",
        body: "line\u{1}with\u{7}controls\ttab",
        scenario: Scenario::Reminder,
        button_style: true,
        progress: true,
        input: Some(Input {
            id: "reply",
            placeholder: "Reply to Mingo",
        }),
        actions: &[
            Action {
                content: "Approve",
                activation: Activation::Background,
                arguments: "action=approve&title=\"x\"",
                hint: Some(Hint::ButtonStyle(ButtonStyle::Success)),
            },
            Action {
                content: "Send",
                activation: Activation::Background,
                arguments: "action=reply",
                hint: Some(Hint::InputId("reply")),
            },
            Action {
                content: "Open",
                activation: Activation::Protocol,
                arguments: "openframe-console://notify?a=1&b=2",
                hint: None,
            },
        ],
    };

    let document = XmlDocument::new().unwrap();
    document.LoadXml(&HSTRING::from(toast.render())).unwrap();
}
