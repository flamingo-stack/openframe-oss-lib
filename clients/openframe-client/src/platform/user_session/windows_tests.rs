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

#[test]
fn homes_are_the_user_accounts_with_a_profile_path() {
    let hkcu = RegKey::predef(winreg::enums::HKEY_CURRENT_USER);
    let key_path = format!(
        "Software\\OpenFrameTest-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    );
    let (list, _) = hkcu.create_subkey(&key_path).unwrap();
    let (alice, _) = list.create_subkey("S-1-5-21-1-2-3-1001").unwrap();
    alice
        .set_value("ProfileImagePath", &r"C:\Users\alice")
        .unwrap();
    let (system, _) = list.create_subkey("S-1-5-18").unwrap();
    system
        .set_value(
            "ProfileImagePath",
            &r"C:\Windows\system32\config\systemprofile",
        )
        .unwrap();
    list.create_subkey("S-1-5-21-1-2-3-1002").unwrap();

    let homes = homes_in(&hkcu, &key_path);
    hkcu.delete_subkey_all(&key_path).unwrap();

    assert_eq!(homes, [PathBuf::from(r"C:\Users\alice")]);
    assert!(homes_in(&hkcu, &key_path).is_empty());
}
