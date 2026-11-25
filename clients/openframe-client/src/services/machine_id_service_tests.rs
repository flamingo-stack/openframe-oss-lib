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

#[test]
fn a_new_machine_does_not_keep_the_restored_machine_id() {
    let dir = tempfile::tempdir().unwrap();
    let dm = directories(&dir);
    let service = MachineIdService::with_saved(&dm, FakeSaved::holding(SAVED_ID));
    service.get_or_create().unwrap();

    service.renew_if_restored(Some(SAVED_ID)).unwrap();

    let renewed = service.get();
    assert_ne!(renewed, SAVED_ID);
    assert!(Uuid::parse_str(&renewed).is_ok());
    assert_eq!(
        MachineIdService::with_saved(&dm, Arc::new(FakeSaved::default()))
            .get_or_create()
            .unwrap(),
        renewed
    );
}

#[test]
fn a_machine_id_not_restored_from_the_record_is_kept_for_a_new_machine() {
    let dir = tempfile::tempdir().unwrap();
    let service = MachineIdService::with_saved(&directories(&dir), Arc::new(FakeSaved::default()));
    let id = service.get_or_create().unwrap();

    service.renew_if_restored(Some(SAVED_ID)).unwrap();
    service.renew_if_restored(None).unwrap();

    assert_eq!(service.get(), id);
}

#[test]
fn an_install_over_a_running_client_saves_its_machine_id_with_the_machine_info() {
    let dir = tempfile::tempdir().unwrap();
    let dm = directories(&dir);
    let on_disk = MachineIdService::with_saved(&dm, Arc::new(FakeSaved::default()))
        .get_or_create()
        .unwrap();
    let saved = FakeSaved::holding(SAVED_ID);

    MachineIdService::with_saved(&dm, saved.clone()).keep_with_machine_info();

    assert_eq!(saved.id().as_deref(), Some(on_disk.as_str()));
}

#[test]
fn an_install_without_a_machine_id_file_saves_nothing() {
    let dir = tempfile::tempdir().unwrap();
    let saved = FakeSaved::holding(SAVED_ID);

    MachineIdService::with_saved(&directories(&dir), saved.clone()).keep_with_machine_info();

    assert_eq!(saved.id().as_deref(), Some(SAVED_ID));
}
