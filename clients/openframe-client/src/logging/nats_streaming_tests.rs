use super::*;

#[test]
fn each_key_kind_uses_its_own_header() {
    assert_eq!(LogStreamKey::Log("k1".into()).header(), ("x-log-key", "k1"));
    assert_eq!(
        LogStreamKey::Initial("k2".into()).header(),
        ("x-initial-key", "k2")
    );
}

#[test]
fn a_stored_log_key_wins_over_the_initial_key() {
    assert_eq!(
        choose_key(Some("log".into()), Some("enroll".into())),
        Some(LogStreamKey::Log("log".into()))
    );
    assert_eq!(
        choose_key(Some(String::new()), Some("enroll".into())),
        Some(LogStreamKey::Initial("enroll".into()))
    );
    assert_eq!(
        choose_key(None, Some("enroll".into())),
        Some(LogStreamKey::Initial("enroll".into()))
    );
    assert_eq!(choose_key(Some(String::new()), Some(String::new())), None);
    assert_eq!(choose_key(None, None), None);
}

#[test]
fn tenant_domain_drops_the_api_prefix() {
    assert_eq!(
        extract_tenant_domain("api.acme.openframe.ai"),
        "acme.openframe.ai"
    );
    assert_eq!(
        extract_tenant_domain("acme.openframe.ai"),
        "acme.openframe.ai"
    );
}
