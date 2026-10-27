use super::*;
use crate::test_support::directories;
use tempfile::TempDir;

fn service_in(dir: &TempDir) -> LastKnownGoodService {
    LastKnownGoodService::new(directories(dir)).unwrap()
}

#[tokio::test]
async fn load_reads_the_anchor_version() {
    let dir = TempDir::new().unwrap();
    let service = service_in(&dir);
    std::fs::write(&service.anchor_file_path, br#"{"version":"1.5.96"}"#).unwrap();

    assert_eq!(service.load().await.unwrap().as_deref(), Some("1.5.96"));
}

#[tokio::test]
async fn load_treats_a_corrupt_anchor_as_missing() {
    let dir = TempDir::new().unwrap();
    let service = service_in(&dir);
    std::fs::write(&service.anchor_file_path, [0u8; 40]).unwrap();

    assert_eq!(service.load().await.unwrap(), None);
    assert!(dir
        .path()
        .join("secured")
        .join("last_known_good.json.corrupt")
        .exists());
}
