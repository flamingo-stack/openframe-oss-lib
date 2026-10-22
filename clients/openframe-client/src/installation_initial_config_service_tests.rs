use super::*;

fn params() -> InstallConfigParams {
    InstallConfigParams {
        server_url: None,
        initial_key: None,
        org_id: None,
        user_id: None,
        local_mode: false,
        tags: Vec::new(),
        remote_access_mode: None,
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

    let mut p = params();
    p.remote_access_mode = Some(RemoteAccessMode::SilentAccess);
    assert!(!p.is_parameterless());
}

fn saved_config(remote_access_mode: Option<RemoteAccessMode>) -> InitialConfiguration {
    let dir = tempfile::tempdir().unwrap();
    let dm = crate::test_support::directories(&dir);
    let mut p = params();
    p.server_url = Some("acme.openframe.ai".to_string());
    p.initial_key = Some("key".to_string());
    p.org_id = Some("org".to_string());
    p.remote_access_mode = remote_access_mode;
    InstallationInitialConfigService::new(dm)
        .unwrap()
        .build_and_save(p)
        .unwrap();
    let raw = std::fs::read_to_string(dir.path().join("secured/initial_config.json")).unwrap();
    serde_json::from_str(&raw).unwrap()
}

#[test]
fn remote_access_mode_is_persisted_by_its_backend_name() {
    let cfg = saved_config(Some(RemoteAccessMode::DenyAccess));
    assert_eq!(cfg.remote_access_mode.as_deref(), Some("DENY_ACCESS"));
}

#[test]
fn no_remote_access_mode_persists_nothing_pending() {
    assert_eq!(saved_config(None).remote_access_mode, None);
}
