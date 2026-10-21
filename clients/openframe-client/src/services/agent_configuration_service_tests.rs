use super::*;
use crate::test_support::directories;

async fn registered(log_key: Option<&str>) -> (tempfile::TempDir, AgentConfigurationService) {
    let dir = tempfile::tempdir().unwrap();
    let service = AgentConfigurationService::new(directories(&dir)).unwrap();
    service
        .save_registration_data(
            "machine".into(),
            "client".into(),
            "secret".into(),
            log_key.map(String::from),
        )
        .await
        .unwrap();
    (dir, service)
}

#[tokio::test]
async fn registration_without_a_log_key_keeps_the_stored_one() {
    let (_dir, service) = registered(Some("stored")).await;

    service
        .save_registration_data("machine".into(), "client".into(), "secret2".into(), None)
        .await
        .unwrap();

    assert_eq!(service.get_log_key().unwrap(), "stored");
    assert_eq!(
        service.get_registration_credentials().unwrap(),
        ("machine".to_string(), "secret2".to_string())
    );
}

#[tokio::test]
async fn registration_with_a_log_key_replaces_the_stored_one() {
    let (_dir, service) = registered(Some("stored")).await;

    service
        .save_registration_data(
            "machine".into(),
            "client".into(),
            "secret".into(),
            Some("new".into()),
        )
        .await
        .unwrap();

    assert_eq!(service.get_log_key().unwrap(), "new");
}

#[tokio::test]
async fn a_config_written_before_log_keys_reads_as_empty() {
    let dir = tempfile::tempdir().unwrap();
    let dm = directories(&dir);
    dm.ensure_directories().unwrap();
    std::fs::write(
        dm.secured_dir().join("agent_config.json"),
        r#"{"machine_id":"machine","client_id":"client","client_secret":"secret","access_token":"","refresh_token":""}"#,
    )
    .unwrap();
    let service = AgentConfigurationService::new(dm).unwrap();

    assert_eq!(service.get_log_key().unwrap(), "");
    service.save_log_key("fetched".into()).await.unwrap();
    assert_eq!(service.get_log_key().unwrap(), "fetched");
}
