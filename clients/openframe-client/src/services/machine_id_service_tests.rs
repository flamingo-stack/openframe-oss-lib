use std::sync::Mutex;

use super::*;
use crate::test_support::directories;

#[derive(Default)]
struct FakeSaved {
    id: Mutex<Option<String>>,
}

impl FakeSaved {
    fn holding(id: &str) -> Arc<Self> {
        Arc::new(Self {
            id: Mutex::new(Some(id.to_string())),
        })
    }

    fn id(&self) -> Option<String> {
        self.id.lock().unwrap().clone()
    }
}

impl SavedMachineId for FakeSaved {
    fn read(&self) -> Option<String> {
        self.id()
    }

    fn save(&self, id: &str) {
        *self.id.lock().unwrap() = Some(id.to_string());
    }
}

const SAVED_ID: &str = "3fb3956d-8c56-4fd0-8262-b8a3e9539219";

#[test]
fn a_reinstall_restores_the_saved_machine_id_instead_of_generating_one() {
    let dir = tempfile::tempdir().unwrap();
    let saved = FakeSaved::holding(SAVED_ID);
    let service = MachineIdService::with_saved(&directories(&dir), saved.clone());

    let id = service.get_or_create().unwrap();

    assert_eq!(id, SAVED_ID);
    assert_eq!(
        MachineIdService::with_saved(&directories(&dir), Arc::new(FakeSaved::default()))
            .get_or_create()
            .unwrap(),
        SAVED_ID
    );
}

#[test]
fn a_fresh_install_generates_a_machine_id_and_saves_it() {
    let dir = tempfile::tempdir().unwrap();
    let saved = Arc::new(FakeSaved::default());
    let service = MachineIdService::with_saved(&directories(&dir), saved.clone());

    let id = service.get_or_create().unwrap();

    assert!(Uuid::parse_str(&id).is_ok());
    assert_eq!(saved.id().as_deref(), Some(id.as_str()));
}

#[test]
fn the_file_wins_over_the_saved_id_and_is_saved() {
    let dir = tempfile::tempdir().unwrap();
    let dm = directories(&dir);
    let on_disk = MachineIdService::with_saved(&dm, Arc::new(FakeSaved::default()))
        .get_or_create()
        .unwrap();
    let saved = FakeSaved::holding(SAVED_ID);

    let id = MachineIdService::with_saved(&dm, saved.clone())
        .get_or_create()
        .unwrap();

    assert_eq!(id, on_disk);
    assert_eq!(saved.id().as_deref(), Some(on_disk.as_str()));
}

#[test]
fn a_saved_value_that_is_not_a_machine_id_is_not_restored() {
    let dir = tempfile::tempdir().unwrap();
    let service =
        MachineIdService::with_saved(&directories(&dir), FakeSaved::holding("not-a-uuid"));

    let id = service.get_or_create().unwrap();

    assert_ne!(id, "not-a-uuid");
    assert!(Uuid::parse_str(&id).is_ok());
}
