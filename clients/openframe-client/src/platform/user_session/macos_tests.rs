use super::*;

#[test]
fn open_launches_without_focus_and_forwards_args() {
    let args = open_args("/Applications/OpenFrame.app", &["--background".to_string()]);
    assert_eq!(
        args,
        [
            "open",
            "-g",
            "-a",
            "/Applications/OpenFrame.app",
            "--args",
            "--background"
        ]
    );
}

#[test]
fn open_without_args_has_no_args_separator() {
    assert_eq!(
        open_args("/Applications/OpenFrame.app", &[]),
        ["open", "-g", "-a", "/Applications/OpenFrame.app"]
    );
}

#[test]
fn app_bundle_path_is_the_dot_app_ancestor() {
    assert_eq!(
        extract_app_bundle_path("/Applications/OpenFrame.app/Contents/MacOS/openframe-chat")
            .as_deref(),
        Some("/Applications/OpenFrame.app")
    );
    assert_eq!(extract_app_bundle_path("/usr/local/bin/agent"), None);
}

#[test]
fn only_a_login_account_counts_as_the_console_user() {
    for (user, expected) in [
        ("jane", true),
        ("", false),
        ("root", false),
        ("_mbsetupuser", false),
    ] {
        assert_eq!(is_login_user(user), expected, "{user:?}");
    }
}

#[test]
fn homes_are_the_login_account_folders() {
    let root = tempfile::TempDir::new().unwrap();
    for dir in ["alice", "bob", "Shared", ".hidden", "_spotlight", "root"] {
        fs::create_dir(root.path().join(dir)).unwrap();
    }
    fs::write(root.path().join(".localized"), "").unwrap();

    let mut homes = homes_under(root.path());
    homes.sort();

    assert_eq!(homes, [root.path().join("alice"), root.path().join("bob")]);
}

#[test]
fn a_missing_users_folder_has_no_homes() {
    let root = tempfile::TempDir::new().unwrap();
    assert!(homes_under(&root.path().join("missing")).is_empty());
}
