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
