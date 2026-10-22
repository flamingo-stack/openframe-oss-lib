use super::*;

fn request(user_id: &str) -> AgentRegistrationRequest {
    AgentRegistrationRequest {
        hostname: "host".to_string(),
        agent_version: "1.0.0".to_string(),
        organization_id: "org-1".to_string(),
        user_id: user_id.to_string(),
        os_type: "WINDOWS".to_string(),
        os_version: "Windows 11 Pro 23H2".to_string(),
        os_build: "22631.3007".to_string(),
        tags: Vec::new(),
    }
}

#[test]
fn serializes_os_version_and_build_as_camel_case() {
    let json = serde_json::to_value(request("user-42")).unwrap();
    assert_eq!(json["osVersion"], "Windows 11 Pro 23H2");
    assert_eq!(json["osBuild"], "22631.3007");
}

#[test]
fn omits_unknown_os_version_and_build() {
    let mut request = request("user-42");
    request.os_version = String::new();
    request.os_build = String::new();
    let json = serde_json::to_value(request).unwrap();
    assert!(json.get("osVersion").is_none());
    assert!(json.get("osBuild").is_none());
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
