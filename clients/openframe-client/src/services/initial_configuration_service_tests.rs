use super::*;
use tempfile::TempDir;

fn service_in(dir: &TempDir) -> InitialConfigurationService {
    let root = dir.path();
    InitialConfigurationService::new(DirectoryManager::with_custom_dirs(
        root.join("logs"),
        root.join("app_support"),
        root.join("secured"),
    ))
    .unwrap()
}

fn write_config(dir: &TempDir, contents: &str) {
    let secured = dir.path().join("secured");
    std::fs::create_dir_all(&secured).unwrap();
    std::fs::write(secured.join("initial_config.json"), contents).unwrap();
}

#[test]
fn not_configured_when_file_is_missing() {
    let dir = TempDir::new().unwrap();
    assert!(!service_in(&dir).is_configured());
}

#[test]
fn not_configured_when_file_is_corrupt() {
    let dir = TempDir::new().unwrap();
    write_config(&dir, "{ this is not json");
    assert!(!service_in(&dir).is_configured());
}

#[test]
fn not_configured_when_server_host_is_blank() {
    let dir = TempDir::new().unwrap();
    write_config(
        &dir,
        r#"{"server_host":"  ","initial_key":"k","local_mode":false}"#,
    );
    assert!(!service_in(&dir).is_configured());
}

#[test]
fn configured_when_server_host_is_present() {
    let dir = TempDir::new().unwrap();
    write_config(
        &dir,
        r#"{"server_host":"acme.openframe.ai","initial_key":"k","local_mode":false,"org_id":"o"}"#,
    );
    assert!(service_in(&dir).is_configured());
}

#[test]
fn a_config_written_before_log_keys_reads_as_empty() {
    let dir = TempDir::new().unwrap();
    write_config(
        &dir,
        r#"{"server_host":"acme.openframe.ai","initial_key":"k","local_mode":false}"#,
    );
    assert_eq!(service_in(&dir).get_log_key().unwrap(), "");
}

#[test]
fn saving_the_log_key_keeps_the_initial_key_and_clearing_it_keeps_the_log_key() {
    let dir = TempDir::new().unwrap();
    write_config(
        &dir,
        r#"{"server_host":"acme.openframe.ai","initial_key":"k","local_mode":false,"org_id":"org"}"#,
    );
    let service = service_in(&dir);

    service.save_log_key("log".into()).unwrap();
    assert_eq!(service.get_log_key().unwrap(), "log");
    assert_eq!(service.get_initial_key().unwrap(), "k");

    service.clear_initial_key().unwrap();
    service.clear_initial_key().unwrap();
    assert_eq!(service.get_initial_key().unwrap(), "");
    assert_eq!(service.get_log_key().unwrap(), "log");
    assert_eq!(service.get_org_id().unwrap(), "org");
}

#[test]
fn config_without_remote_access_mode_has_none_pending() {
    let dir = TempDir::new().unwrap();
    write_config(
        &dir,
        r#"{"server_host":"acme.openframe.ai","initial_key":"k","local_mode":false}"#,
    );
    assert_eq!(service_in(&dir).get_remote_access_mode().unwrap(), None);
}

#[test]
fn clearing_the_remote_access_mode_keeps_the_rest_of_the_config() {
    let dir = TempDir::new().unwrap();
    write_config(
        &dir,
        r#"{"server_host":"acme.openframe.ai","initial_key":"k","local_mode":false,"org_id":"org","remote_access_mode":"SILENT_ACCESS"}"#,
    );
    let service = service_in(&dir);

    service.clear_remote_access_mode().unwrap();

    assert_eq!(service.get_remote_access_mode().unwrap(), None);
    assert_eq!(service.get_org_id().unwrap(), "org");
    assert_eq!(service.get_initial_key().unwrap(), "k");
    let raw = std::fs::read_to_string(dir.path().join("secured/initial_config.json")).unwrap();
    assert!(!raw.contains("remote_access_mode"));
}
