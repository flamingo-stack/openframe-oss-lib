use super::*;
use crate::test_support::directories;
use crate::utils::fs::CorruptJson;

#[tokio::test]
async fn a_corrupt_file_is_an_error_and_stays_in_place() {
    let dir = tempfile::tempdir().unwrap();
    let dm = directories(&dir);
    let service = InstalledToolsService::new(dm.clone()).unwrap();
    let path = dm.secured_dir().join("installed_tools.json");
    std::fs::write(&path, [0u8; 32]).unwrap();

    let err = service.get_all().await.unwrap_err();

    assert!(err.is::<CorruptJson>(), "{err:#}");
    assert_eq!(std::fs::read(&path).unwrap(), [0u8; 32]);
}

#[tokio::test]
async fn a_saved_tool_reads_back() {
    let dir = tempfile::tempdir().unwrap();
    let service = InstalledToolsService::new(directories(&dir)).unwrap();

    service
        .save(InstalledTool {
            tool_agent_id: "fleetmdm-server".into(),
            ..Default::default()
        })
        .await
        .unwrap();

    let tools = service.get_all().await.unwrap();
    assert_eq!(tools.len(), 1);
    assert_eq!(tools[0].tool_agent_id, "fleetmdm-server");
}
