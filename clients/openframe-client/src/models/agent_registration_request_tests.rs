use super::*;

fn request(user_id: &str) -> AgentRegistrationRequest {
    AgentRegistrationRequest {
        hostname: "host".to_string(),
        agent_version: "1.0.0".to_string(),
        organization_id: "org-1".to_string(),
        user_id: user_id.to_string(),
        os_type: "WINDOWS".to_string(),
        os_version: String::new(),
        os_build: String::new(),
        tags: Vec::new(),
    }
}

#[test]
fn serializes_os_version_and_build_as_camel_case() {
    let mut request = request("user-42");
    request.os_version = "macOS 15.6.1".to_string();
    request.os_build = "24G90".to_string();
    let json = serde_json::to_value(request).unwrap();
    assert_eq!(json["osVersion"], "macOS 15.6.1");
    assert_eq!(json["osBuild"], "24G90");
}

#[test]
fn omits_os_version_and_build_when_empty() {
    let json = serde_json::to_value(request("user-42")).unwrap();
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
