use super::*;

#[test]
fn an_installed_manager_reports_present_whatever_else_is_true() {
    for supported in [true, false] {
        for console_user in [true, false] {
            assert_eq!(
                resolve(Presence::Present, supported, console_user),
                ManagerState::Present
            );
        }
    }
}

#[test]
fn an_unsupported_manager_is_never_missing_or_unknown() {
    for presence in [Presence::Absent, Presence::Unknown] {
        for console_user in [true, false] {
            assert_eq!(
                resolve(presence, false, console_user),
                ManagerState::Unsupported
            );
        }
    }
}

#[test]
fn a_supported_absent_manager_is_missing_only_with_a_console_user() {
    assert_eq!(resolve(Presence::Absent, true, true), ManagerState::Missing);
    assert_eq!(
        resolve(Presence::Absent, true, false),
        ManagerState::Unknown
    );
}

#[test]
fn an_inconclusive_probe_reports_unknown_either_way() {
    assert_eq!(
        resolve(Presence::Unknown, true, true),
        ManagerState::Unknown
    );
    assert_eq!(
        resolve(Presence::Unknown, true, false),
        ManagerState::Unknown
    );
}
