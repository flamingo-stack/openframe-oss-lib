use super::*;

#[cfg(windows)]
#[test]
fn every_process_reports_its_windows_session() {
    let own = std::process::id();

    let processes = snapshot();

    let this = processes.iter().find(|p| p.pid == own).unwrap();
    assert!(this.session.is_some());
}

#[cfg(not(windows))]
#[test]
fn sessions_are_absent_off_windows() {
    assert!(snapshot().iter().all(|p| p.session.is_none()));
}
