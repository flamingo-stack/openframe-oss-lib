use super::*;
use crate::test_support::directories;

#[test]
fn regenerating_writes_a_new_id_that_later_reads_return() {
    let dir = tempfile::tempdir().unwrap();
    let dm = directories(&dir);
    let service = MachineIdService::new(&dm);
    let previous = service.get_or_create().unwrap();

    let regenerated = service.regenerate().unwrap();

    assert_ne!(previous, regenerated);
    assert_eq!(service.get(), regenerated);
    assert_eq!(
        MachineIdService::new(&dm).get_or_create().unwrap(),
        regenerated
    );
}
