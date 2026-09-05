use super::*;

fn make_token(payload: &str) -> String {
    format!("header.{}.sig", URL_SAFE_NO_PAD.encode(payload.as_bytes()))
}

#[test]
fn decodes_exp_and_iat() {
    let token = make_token(r#"{"iat":1699996400,"exp":1700000000,"sub":"machine"}"#);
    let times = token_times_unix(&token).unwrap();
    assert_eq!(times.exp, 1700000000);
    assert_eq!(times.iat, Some(1699996400));
    assert_eq!(times.ttl_secs(), Some(3600));
}

#[test]
fn decodes_exp_without_iat() {
    let token = make_token(r#"{"exp":1700000000,"sub":"machine"}"#);
    let times = token_times_unix(&token).unwrap();
    assert_eq!(times.exp, 1700000000);
    assert_eq!(times.iat, None);
    assert_eq!(times.ttl_secs(), None);
}

#[test]
fn ttl_is_none_when_not_positive() {
    let token = make_token(r#"{"iat":1700000000,"exp":1700000000}"#);
    assert_eq!(token_times_unix(&token).unwrap().ttl_secs(), None);
    let token = make_token(r#"{"iat":1700000100,"exp":1700000000}"#);
    assert_eq!(token_times_unix(&token).unwrap().ttl_secs(), None);
}

#[test]
fn none_without_exp_claim() {
    let token = make_token(r#"{"iat":1699996400,"sub":"machine"}"#);
    assert_eq!(token_times_unix(&token), None);
}

#[test]
fn none_when_malformed() {
    assert_eq!(token_times_unix("not-a-jwt"), None);
    assert_eq!(token_times_unix(""), None);
}

#[test]
fn none_when_wrong_segment_count() {
    let payload = URL_SAFE_NO_PAD.encode(r#"{"exp":1700000000}"#.as_bytes());
    assert_eq!(token_times_unix(&format!("header.{payload}")), None);
    assert_eq!(
        token_times_unix(&format!("header.{payload}.sig.extra")),
        None
    );
}
