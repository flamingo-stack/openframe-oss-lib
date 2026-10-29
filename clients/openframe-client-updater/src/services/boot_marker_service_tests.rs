use super::*;

struct Setup {
    _dir: tempfile::TempDir,
    svc: BootMarkerService,
    secured: PathBuf,
}

fn setup() -> Setup {
    let dir = tempfile::tempdir().unwrap();
    let secured = dir.path().join("secured");
    fs::create_dir_all(&secured).unwrap();

    let dm = DirectoryManager::with_custom_dirs(
        dir.path().join("logs"),
        dir.path().to_path_buf(),
        secured.clone(),
    );
    let svc = BootMarkerService::new(&dm);
    Setup {
        _dir: dir,
        svc,
        secured,
    }
}

#[test]
fn boot_marker_version_trims_and_rejects_empty() {
    let s = setup();
    assert!(s.svc.boot_marker_version().is_none());

    fs::write(s.secured.join("boot.marker"), b"  1.2.3\n").unwrap();
    assert_eq!(s.svc.boot_marker_version().as_deref(), Some("1.2.3"));

    fs::write(s.secured.join("boot.marker"), b"  \n").unwrap();
    assert!(s.svc.boot_marker_version().is_none());
}

#[test]
fn clear_boot_marker_removes_and_tolerates_absence() {
    let s = setup();
    s.svc.clear_boot_marker().unwrap();

    fs::write(s.secured.join("boot.marker"), b"1.0.0").unwrap();
    s.svc.clear_boot_marker().unwrap();
    assert!(s.svc.boot_marker_version().is_none());
}

#[test]
fn updates_are_delegated_only_by_the_client_that_booted() {
    let s = setup();
    assert!(!s.svc.client_delegates_updates(), "no markers at all");

    fs::write(s.secured.join("boot.marker"), b"1.4.0").unwrap();
    assert!(
        !s.svc.client_delegates_updates(),
        "an older client writes no delegation marker"
    );

    fs::write(s.secured.join("client_update_delegated"), b"1.5.0\n").unwrap();
    assert!(
        !s.svc.client_delegates_updates(),
        "a downgrade back to 1.4.0 leaves the newer client's marker behind"
    );

    fs::write(s.secured.join("boot.marker"), b"1.5.0").unwrap();
    assert!(s.svc.client_delegates_updates());
}
