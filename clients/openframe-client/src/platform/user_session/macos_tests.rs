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
