use super::*;
use crate::test_support::directories;
use tempfile::TempDir;

const CORRUPT: [&[u8]; 4] = [
    &[0u8; 256],
    b"",
    br#"{"machine_id":"m-1","cli"#,
    &[0xff, 0xfe, 0x7b],
];

struct Fixture {
    service: AgentConfigurationService,
    path: PathBuf,
    copy: PathBuf,
    _dir: TempDir,
}

fn fixture() -> Fixture {
    let dir = tempfile::tempdir().unwrap();
    let dm = directories(&dir);
    let path = dm.secured_dir().join("agent_config.json");
    Fixture {
        service: AgentConfigurationService::new(dm).unwrap(),
        copy: path.with_file_name("agent_config.json.corrupt"),
        path,
        _dir: dir,
    }
}

fn saved() -> PersistedMachineInfo {
    PersistedMachineInfo {
        machine_id: "m-1".into(),
        client_secret: "secret-1".into(),
        user_id: None,
    }
}

#[test]
fn reading_a_corrupt_file_is_a_corrupt_json_error_and_leaves_it_in_place() {
    let f = fixture();
    std::fs::write(&f.path, [0u8; 64]).unwrap();

    let err = f.service.get_machine_id().unwrap_err();

    assert!(err.is::<CorruptJson>(), "{err:#}");
    assert!(err.to_string().contains("size 64, all zero: true"), "{err}");
    assert_eq!(std::fs::read(&f.path).unwrap(), [0u8; 64]);
}

#[tokio::test]
async fn a_corrupt_file_is_rebuilt_from_the_saved_record_with_empty_tokens() {
    for contents in CORRUPT {
        let f = fixture();
        std::fs::write(&f.path, contents).unwrap();

        f.service.replace_corrupt(Some(&saved())).await.unwrap();

        assert_eq!(f.service.get_machine_id().unwrap(), "m-1");
        assert_eq!(
            f.service.get_client_credentials().await.unwrap(),
            ("agent_m-1".to_string(), "secret-1".to_string())
        );
        assert_eq!(f.service.get_access_token().await.unwrap(), "");
        assert_eq!(f.service.get_refresh_token().await.unwrap(), "");
        assert_eq!(std::fs::read(&f.copy).unwrap(), contents);

        let rebuilt = std::fs::read(&f.path).unwrap();
        f.service.replace_corrupt(Some(&saved())).await.unwrap();
        assert_eq!(std::fs::read(&f.path).unwrap(), rebuilt);
        assert_eq!(std::fs::read(&f.copy).unwrap(), contents);
    }
}

#[tokio::test]
async fn a_corrupt_file_without_a_saved_record_is_emptied_so_the_device_registers_again() {
    for contents in CORRUPT {
        let f = fixture();
        std::fs::write(&f.path, contents).unwrap();

        f.service.replace_corrupt(None).await.unwrap();

        assert_eq!(f.service.get_machine_id().unwrap(), "");
        assert_eq!(std::fs::read(&f.copy).unwrap(), contents);
    }
}

#[tokio::test]
async fn an_older_corrupt_copy_is_replaced() {
    let f = fixture();
    std::fs::write(&f.copy, b"older").unwrap();
    std::fs::write(&f.path, b"newer garbage").unwrap();

    f.service.replace_corrupt(Some(&saved())).await.unwrap();

    assert_eq!(std::fs::read(&f.copy).unwrap(), b"newer garbage");
}

#[tokio::test]
async fn a_failed_copy_does_not_stop_the_rebuild() {
    let f = fixture();
    std::fs::create_dir(&f.copy).unwrap();
    std::fs::write(&f.path, b"garbage").unwrap();

    f.service.replace_corrupt(Some(&saved())).await.unwrap();

    assert_eq!(f.service.get_machine_id().unwrap(), "m-1");
}

#[tokio::test]
async fn a_valid_file_is_left_untouched() {
    let f = fixture();
    f.service
        .save_registration_data("m-2".into(), "agent_m-2".into(), "secret-2".into())
        .await
        .unwrap();
    f.service
        .update_tokens("access".into(), "refresh".into())
        .await
        .unwrap();
    let before = std::fs::read(&f.path).unwrap();

    f.service.replace_corrupt(Some(&saved())).await.unwrap();

    assert_eq!(std::fs::read(&f.path).unwrap(), before);
    assert!(!f.copy.exists());
}

#[tokio::test]
async fn a_missing_file_stays_missing() {
    let f = fixture();

    f.service.replace_corrupt(Some(&saved())).await.unwrap();

    assert!(!f.path.exists());
    assert_eq!(f.service.get_machine_id().unwrap(), "");
}

#[tokio::test]
async fn replacing_the_registration_drops_the_tokens_of_the_previous_machine() {
    let dir = tempfile::tempdir().unwrap();
    let agent = crate::test_support::registered_agent(&directories(&dir)).await;

    agent
        .replace_registration("m-2".into(), "client-2".into(), "secret-2".into())
        .await
        .unwrap();

    assert_eq!(
        agent.get_registration_credentials().unwrap(),
        ("m-2".to_string(), "secret-2".to_string())
    );
    assert_eq!(
        agent.get_client_credentials().await.unwrap(),
        ("client-2".to_string(), "secret-2".to_string())
    );
    assert!(agent.get_access_token().await.unwrap().is_empty());
}
