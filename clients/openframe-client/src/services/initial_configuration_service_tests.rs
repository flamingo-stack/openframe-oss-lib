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
