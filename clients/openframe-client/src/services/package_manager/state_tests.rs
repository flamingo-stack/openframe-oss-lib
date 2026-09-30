use super::*;

#[test]
fn an_installed_manager_reports_present_whatever_the_verdict() {
    assert_eq!(resolve(Presence::Present, true), ManagerState::Present);
    assert_eq!(resolve(Presence::Present, false), ManagerState::Present);
}

#[test]
fn an_unsupported_manager_is_never_missing_or_unknown() {
    assert_eq!(resolve(Presence::Absent, false), ManagerState::Unsupported);
    assert_eq!(resolve(Presence::Unknown, false), ManagerState::Unsupported);
}

#[test]
fn a_supported_manager_reports_what_the_probe_found() {
    assert_eq!(resolve(Presence::Absent, true), ManagerState::Missing);
    assert_eq!(resolve(Presence::Unknown, true), ManagerState::Unknown);
}
