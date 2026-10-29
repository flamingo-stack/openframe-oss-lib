use super::*;
use crate::models::update_state::UpdatePhase;
use crate::test_support::directories;
use tempfile::TempDir;

fn service_in(dir: &TempDir) -> UpdateStateService {
    UpdateStateService::new(directories(dir)).unwrap()
}

#[tokio::test]
async fn save_and_load_round_trip() {
    let dir = TempDir::new().unwrap();
    let service = service_in(&dir);
    let mut state = UpdateState::new("1.5.99".to_string());
    state.phase = UpdatePhase::Downloading;

    service.save(&state).await.unwrap();
    let loaded = service.load().await.unwrap().unwrap();

    assert_eq!(loaded.target_version, "1.5.99");
    assert_eq!(loaded.phase, UpdatePhase::Downloading);
}

#[tokio::test]
async fn a_corrupt_state_loads_as_no_update_in_progress() {
    let dir = TempDir::new().unwrap();
    let service = service_in(&dir);
    std::fs::write(&service.state_file_path, [0u8; 150]).unwrap();

    assert!(service.load().await.unwrap().is_none());
    assert!(!service.has_incomplete_update().await.unwrap());
    assert!(dir
        .path()
        .join("secured")
        .join("update_state.json.corrupt")
        .exists());
}

#[tokio::test]
async fn read_state_tells_a_corrupt_file_from_a_missing_one() {
    let dir = TempDir::new().unwrap();
    let service = service_in(&dir);
    assert!(matches!(
        service.read_state().await.unwrap(),
        JsonFile::Missing
    ));

    std::fs::write(&service.state_file_path, b"{\"target_version\": \"1.3").unwrap();
    assert!(matches!(
        service.read_state().await.unwrap(),
        JsonFile::Corrupt
    ));
}

fn update_message(version: &str) -> OpenFrameClientUpdateMessage {
    OpenFrameClientUpdateMessage {
        version: version.to_string(),
        download_configurations: vec![],
    }
}

#[tokio::test]
async fn a_saved_update_survives_a_restart() {
    let dir = TempDir::new().unwrap();
    service_in(&dir)
        .save_update(update_message("1.5.107"))
        .await
        .unwrap();

    let saved = service_in(&dir).load_saved_update().await.unwrap();

    assert_eq!(saved.version(), "1.5.107");
    assert_eq!(saved.attempts, 0);
}

#[tokio::test]
async fn attempts_and_drops_only_touch_the_saved_update_they_name() {
    let dir = TempDir::new().unwrap();
    let service = service_in(&dir);
    service
        .save_update(update_message("1.5.107"))
        .await
        .unwrap();

    assert!(!service.start_saved_attempt("1.5.106").await.unwrap());
    service.clear_saved_update_for("1.5.106").await.unwrap();
    assert_eq!(service.load_saved_update().await.unwrap().attempts, 0);

    assert!(service.start_saved_attempt("v1.5.107").await.unwrap());
    assert_eq!(service.load_saved_update().await.unwrap().attempts, 1);

    service.clear_saved_update_for("1.5.107").await.unwrap();
    assert!(service.load_saved_update().await.is_none());
}

#[tokio::test]
async fn clearing_a_missing_saved_update_is_fine() {
    let dir = TempDir::new().unwrap();
    let service = service_in(&dir);

    service.clear_saved_update().await.unwrap();
    service.expire_saved_update("1.5.107").await.unwrap();
    assert!(!service.start_saved_attempt("1.5.107").await.unwrap());
}

#[tokio::test]
async fn a_corrupt_saved_update_reads_as_none_and_is_moved_aside() {
    let dir = TempDir::new().unwrap();
    let service = service_in(&dir);
    std::fs::write(&service.saved_update_path, [0u8; 64]).unwrap();

    assert!(service.load_saved_update().await.is_none());
    assert!(dir
        .path()
        .join("secured")
        .join("saved_client_update.json.corrupt")
        .exists());
}
