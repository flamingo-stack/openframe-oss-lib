use super::*;
use tempfile::TempDir;

fn service_in(dir: &TempDir) -> OpenFrameClientInfoService {
    let root = dir.path();
    OpenFrameClientInfoService::new(DirectoryManager::with_custom_dirs(
        root.join("logs"),
        root.join("app_support"),
        root.join("secured"),
    ))
    .unwrap()
}

fn write_info(dir: &TempDir, contents: &[u8]) {
    std::fs::write(
        dir.path()
            .join("secured")
            .join("openframe_client_info.json"),
        contents,
    )
    .unwrap();
}

#[tokio::test]
async fn get_returns_default_for_a_corrupt_file() {
    let dir = TempDir::new().unwrap();
    let service = service_in(&dir);
    write_info(&dir, &[0u8; 200]);

    let info = service.get().await.unwrap();

    assert_eq!(info.current_version, "");
    assert!(dir
        .path()
        .join("secured")
        .join("openframe_client_info.json.corrupt")
        .exists());
}

#[tokio::test]
async fn reconcile_rewrites_a_corrupt_file_with_the_running_version() {
    let dir = TempDir::new().unwrap();
    let service = service_in(&dir);
    write_info(&dir, b"");

    service.reconcile_version("1.5.96").await.unwrap();

    assert_eq!(service.get().await.unwrap().current_version, "1.5.96");
}

#[tokio::test]
async fn set_update_status_works_over_a_corrupt_file() {
    let dir = TempDir::new().unwrap();
    let service = service_in(&dir);
    write_info(&dir, &[0u8; 200]);

    service
        .set_update_status(
            crate::models::openframe_client_info::ClientUpdateStatus::Updating,
            Some("1.5.99".to_string()),
        )
        .await
        .unwrap();

    let info = service.get().await.unwrap();
    assert_eq!(info.target_version.as_deref(), Some("1.5.99"));
}
