use super::*;

fn parse(json: &str) -> AgentRegistrationResponse {
    serde_json::from_str(json).unwrap()
}

#[test]
fn a_response_without_a_log_key_still_parses() {
    let response = parse(r#"{"machineId":"m","clientId":"c","clientSecret":"s"}"#);
    assert_eq!(response.machine_id, "m");
    assert_eq!(response.log_key, None);
}

#[test]
fn a_null_log_key_reads_as_absent() {
    let response = parse(r#"{"machineId":"m","clientId":"c","clientSecret":"s","logKey":null}"#);
    assert_eq!(response.log_key, None);
}

#[test]
fn a_log_key_is_read_from_camel_case() {
    let response = parse(r#"{"machineId":"m","clientId":"c","clientSecret":"s","logKey":"k"}"#);
    assert_eq!(response.log_key.as_deref(), Some("k"));
}
