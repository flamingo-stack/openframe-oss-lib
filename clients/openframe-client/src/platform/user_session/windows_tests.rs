use super::*;

#[test]
fn a_session_is_named_by_its_logged_on_user() {
    let mut session = 0;
    unsafe { ProcessIdToSessionId(std::process::id(), &mut session) }.unwrap();

    let name = session_user_name(session);

    if session == 0 {
        assert_eq!(name, None);
    } else {
        let user = std::env::var("USERNAME").unwrap();
        assert!(
            name.as_deref()
                .is_some_and(|name| name.eq_ignore_ascii_case(&user)),
            "session {session}: {name:?}, expected {user}"
        );
    }
}

#[test]
fn an_unknown_session_has_no_user() {
    assert_eq!(session_user_name(u32::MAX - 1), None);
}
