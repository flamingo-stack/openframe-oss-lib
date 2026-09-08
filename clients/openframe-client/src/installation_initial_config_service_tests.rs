use super::*;

fn params() -> InstallConfigParams {
    InstallConfigParams {
        server_url: None,
        initial_key: None,
        org_id: None,
        user_id: None,
        local_mode: false,
        tags: Vec::new(),
    }
}

#[test]
fn no_arguments_is_parameterless() {
    assert!(params().is_parameterless());
}

#[test]
fn blank_arguments_are_parameterless() {
    let mut p = params();
    p.server_url = Some("  ".to_string());
    p.org_id = Some(String::new());
    assert!(p.is_parameterless());
}

#[test]
fn any_core_argument_is_parameterized() {
    let mut p = params();
    p.server_url = Some("acme.openframe.ai".to_string());
    assert!(!p.is_parameterless());

    let mut p = params();
    p.initial_key = Some("key".to_string());
    assert!(!p.is_parameterless());

    let mut p = params();
    p.org_id = Some("org".to_string());
    assert!(!p.is_parameterless());
}

#[test]
fn extra_arguments_alone_are_parameterized() {
    let mut p = params();
    p.user_id = Some("user".to_string());
    assert!(!p.is_parameterless());

    let mut p = params();
    p.local_mode = true;
    assert!(!p.is_parameterless());

    let mut p = params();
    p.tags = vec!["env=dev".to_string()];
    assert!(!p.is_parameterless());
}
