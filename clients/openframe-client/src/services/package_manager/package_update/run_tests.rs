use super::*;

#[test]
fn a_holder_is_named_by_its_image_file() {
    let holder = Holder {
        pid: 42,
        image: std::path::PathBuf::from(
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        ),
        session: None,
    };

    let info = holder_info(&holder, Some("jane".to_string()));

    assert_eq!(info.app, "Google Chrome");
    assert_eq!(info.user.as_deref(), Some("jane"));
}
