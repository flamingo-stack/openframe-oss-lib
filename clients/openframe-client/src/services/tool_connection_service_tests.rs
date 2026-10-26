use super::*;
use tempfile::TempDir;

fn service_in(dir: &TempDir) -> ToolConnectionService {
    let root = dir.path();
    ToolConnectionService::new(DirectoryManager::with_custom_dirs(
        root.join("logs"),
        root.join("app_support"),
        root.join("secured"),
    ))
    .unwrap()
}

fn file_in(dir: &TempDir) -> PathBuf {
    dir.path().join("secured").join("tool_connections.json")
}

fn connection(tool_agent_id: &str, agent_tool_id: &str) -> ToolConnection {
    ToolConnection {
        tool_agent_id: tool_agent_id.to_string(),
        agent_tool_id: agent_tool_id.to_string(),
        published: true,
    }
}

#[tokio::test]
async fn save_upserts_by_tool_agent_id() {
    let dir = TempDir::new().unwrap();
    let service = service_in(&dir);

    service
        .save(connection("fleetmdm-server", "a"))
        .await
        .unwrap();
    service
        .save(connection("meshcentral-server", "b"))
        .await
        .unwrap();
    service
        .save(connection("fleetmdm-server", "c"))
        .await
        .unwrap();

    assert_eq!(
        service.get_all().await.unwrap(),
        vec![
            connection("fleetmdm-server", "c"),
            connection("meshcentral-server", "b")
        ]
    );
}

#[tokio::test]
async fn save_recovers_from_a_nul_filled_file() {
    let dir = TempDir::new().unwrap();
    let service = service_in(&dir);
    std::fs::write(file_in(&dir), [0u8; 300]).unwrap();

    service
        .save(connection("fleetmdm-server", "a"))
        .await
        .unwrap();

    assert_eq!(
        service.get_all().await.unwrap(),
        vec![connection("fleetmdm-server", "a")]
    );
    let quarantined = dir
        .path()
        .join("secured")
        .join("tool_connections.json.corrupt");
    assert_eq!(std::fs::read(quarantined).unwrap(), vec![0u8; 300]);
}

#[tokio::test]
async fn save_recovers_from_an_empty_file() {
    let dir = TempDir::new().unwrap();
    let service = service_in(&dir);
    std::fs::write(file_in(&dir), b"").unwrap();

    service
        .save(connection("meshcentral-server", "b"))
        .await
        .unwrap();

    assert_eq!(
        service.get_all().await.unwrap(),
        vec![connection("meshcentral-server", "b")]
    );
}

#[tokio::test]
async fn delete_works_when_the_file_is_corrupt() {
    let dir = TempDir::new().unwrap();
    let service = service_in(&dir);
    std::fs::write(file_in(&dir), b"[{\"tool_agent_id\":").unwrap();

    assert!(!service
        .delete_by_tool_agent_id("fleetmdm-server")
        .await
        .unwrap());
    service
        .save(connection("fleetmdm-server", "a"))
        .await
        .unwrap();
    assert!(service
        .delete_by_tool_agent_id("fleetmdm-server")
        .await
        .unwrap());
    assert!(service.get_all().await.unwrap().is_empty());
}
