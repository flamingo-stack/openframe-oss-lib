use super::safe_join;
use std::path::{Path, PathBuf};

fn target() -> PathBuf {
    PathBuf::from("/Applications")
}

fn join(entry: &str) -> Option<PathBuf> {
    safe_join(&target(), Path::new(entry)).ok()
}

#[test]
fn accepts_leading_current_dir() {
    assert_eq!(
        join("./OpenFrame.app/Contents/MacOS/openframe-chat"),
        Some(target().join("./OpenFrame.app/Contents/MacOS/openframe-chat"))
    );
}

#[test]
fn accepts_a_plain_nested_entry() {
    assert_eq!(
        join("OpenFrame.app/Contents/Info.plist"),
        Some(target().join("OpenFrame.app/Contents/Info.plist"))
    );
}

#[test]
fn accepts_a_bare_filename() {
    assert_eq!(
        join("pax_global_header"),
        Some(target().join("pax_global_header"))
    );
}

#[test]
fn rejects_an_absolute_entry() {
    assert!(join("/Library/LaunchDaemons/evil.plist").is_none());
}

#[test]
fn rejects_parent_traversal() {
    assert!(join("../../../../etc/cron.d/evil").is_none());
}
#[test]
fn rejects_interior_parent_traversal() {
    assert!(join("OpenFrame.app/../../../etc/passwd").is_none());
}

#[test]
fn rejects_a_root_relative_entry() {
    assert!(join("//srv/evil").is_none());
}
#[test]
fn rejection_names_the_offending_entry() {
    let err = safe_join(&target(), Path::new("../escape"))
        .expect_err("traversal must be refused")
        .to_string();
    assert!(err.contains("../escape"), "unhelpful error: {err}");
}
