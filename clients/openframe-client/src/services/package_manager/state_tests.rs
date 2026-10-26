use super::*;

const SESSIONS: [Session; 2] = [Session::Active, Session::None];

#[test]
fn an_installed_manager_reports_present_whatever_else_is_true() {
    for supported in [true, false] {
        for session in SESSIONS {
            assert_eq!(
                resolve(Presence::Present, supported, session),
                ManagerState::Present
            );
        }
    }
}

#[test]
fn an_unsupported_manager_is_never_missing_or_unknown() {
    for presence in [Presence::Absent, Presence::Unknown] {
        for session in SESSIONS {
            assert_eq!(resolve(presence, false, session), ManagerState::Unsupported);
        }
    }
}

#[test]
fn a_supported_absent_manager_is_missing_only_with_a_console_session() {
    assert_eq!(
        resolve(Presence::Absent, true, Session::Active),
        ManagerState::Missing
    );
    assert_eq!(
        resolve(Presence::Absent, true, Session::None),
        ManagerState::Unknown
    );
}

#[test]
fn an_inconclusive_probe_reports_unknown_either_way() {
    for session in SESSIONS {
        assert_eq!(
            resolve(Presence::Unknown, true, session),
            ManagerState::Unknown
        );
    }
}
