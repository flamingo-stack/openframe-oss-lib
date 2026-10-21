use super::*;

fn request(user_id: &str) -> AgentRegistrationRequest {
    AgentRegistrationRequest {
        hostname: "host".to_string(),
        agent_version: "1.0.0".to_string(),
        organization_id: "org-1".to_string(),
        user_id: user_id.to_string(),
        os_type: "WINDOWS".to_string(),
        tags: Vec::new(),
        binary_sha256: "ccb15641".to_string(),
    }
}

#[test]
fn serializes_user_id_as_camel_case_when_present() {
    let json = serde_json::to_value(request("user-42")).unwrap();
    assert_eq!(json["userId"], "user-42");
}

#[test]
fn omits_user_id_when_empty() {
    let json = serde_json::to_value(request("")).unwrap();
    assert!(json.get("userId").is_none());
}

#[test]
fn serializes_binary_sha256_as_camel_case() {
    let json = serde_json::to_value(request("user-42")).unwrap();
    assert_eq!(json["binarySha256"], "ccb15641");
}
