use super::*;
use std::collections::HashSet;
use std::path::PathBuf;

fn tool_dir() -> PathBuf {
    PathBuf::from(r"C:\ProgramData\OpenFrame\meshcentral-agent")
}

fn holder(pid: u32, name: &str) -> EnrichedHolder {
    EnrichedHolder {
        pid,
        proc_name: name.to_string(),
        image_path: None,
        app_type: 0,
        service_short_name: None,
    }
}

#[test]
fn terminates_orphan_shells() {
    let protected = HashSet::new();
    for shell in [
        "cmd.exe",
        "powershell.exe",
        "pwsh.exe",
        "conhost.exe",
        "POWERSHELL.EXE",
    ] {
        let h = holder(4321, shell);
        assert_eq!(
            classify_holder(&h, &tool_dir(), &protected),
            HolderAction::Terminate,
            "{shell} should be terminated"
        );
    }
}

#[test]
fn matches_shell_by_full_image_name() {
    // Forward slashes parse as separators on every host, so file_name() resolves to cmd.exe.
    let h = holder(4321, "C:/Windows/System32/cmd.exe");
    assert_eq!(
        classify_holder(&h, &tool_dir(), &HashSet::new()),
        HolderAction::Terminate
    );
}

#[cfg(windows)]
#[test]
fn matches_shell_by_backslash_image_name() {
    let h = holder(4321, r"C:\Windows\System32\cmd.exe");
    assert_eq!(
        classify_holder(&h, &tool_dir(), &HashSet::new()),
        HolderAction::Terminate
    );
}

#[test]
fn skips_self_and_ancestors() {
    let mut protected = HashSet::new();
    protected.insert(4321);
    let h = holder(4321, "cmd.exe");
    assert_eq!(
        classify_holder(&h, &tool_dir(), &protected),
        HolderAction::Skip
    );
}

#[test]
fn skips_idle_and_system_pids() {
    for pid in [0u32, 4] {
        let h = holder(pid, "cmd.exe");
        assert_eq!(
            classify_holder(&h, &tool_dir(), &HashSet::new()),
            HolderAction::Skip,
            "pid {pid} must be skipped"
        );
    }
}

#[test]
fn skips_critical_system_processes() {
    for name in [
        "services.exe",
        "svchost.exe",
        "lsass.exe",
        "csrss.exe",
        "wininit.exe",
        "smss.exe",
        "winlogon.exe",
        "System",
        "SVCHOST.EXE",
    ] {
        let h = holder(9000, name);
        assert_eq!(
            classify_holder(&h, &tool_dir(), &HashSet::new()),
            HolderAction::Skip,
            "{name} must be skipped"
        );
    }
}

#[test]
fn skips_rmcritical_app_type_even_for_a_shell_name() {
    let mut h = holder(9000, "cmd.exe");
    h.app_type = RM_CRITICAL_APP_TYPE;
    assert_eq!(
        classify_holder(&h, &tool_dir(), &HashSet::new()),
        HolderAction::Skip
    );
}

#[test]
fn terminates_stray_process_under_tool_dir() {
    let mut h = holder(9000, "osqueryd.exe");
    h.image_path = Some(tool_dir().join("osqueryd").join("osqueryd.exe"));
    assert_eq!(
        classify_holder(&h, &tool_dir(), &HashSet::new()),
        HolderAction::Terminate
    );
}

#[test]
fn skips_unrelated_foreign_process() {
    let mut h = holder(9000, "notepad.exe");
    h.image_path = Some(PathBuf::from(r"C:\Windows\System32\notepad.exe"));
    assert_eq!(
        classify_holder(&h, &tool_dir(), &HashSet::new()),
        HolderAction::Skip
    );
}

#[test]
fn stops_service_whose_binary_is_under_the_tool_dir() {
    let mut h = holder(9000, "meshagent.exe");
    h.image_path = Some(tool_dir().join("agent.exe"));
    h.service_short_name = Some("Mesh Agent".to_string());
    assert_eq!(
        classify_holder(&h, &tool_dir(), &HashSet::new()),
        HolderAction::StopService
    );
}

#[test]
fn skips_foreign_service_never_terminates_it() {
    let mut h = holder(9000, "third-party.exe");
    h.image_path = Some(PathBuf::from(r"C:\Program Files\Other\svc.exe"));
    h.service_short_name = Some("OtherVendorSvc".to_string());
    assert_eq!(
        classify_holder(&h, &tool_dir(), &HashSet::new()),
        HolderAction::Skip
    );
}

// Drive-letter/case-insensitive path matching is a Windows concept; parse it there.
#[cfg(windows)]
#[test]
fn image_under_dir_is_case_insensitive() {
    let child = PathBuf::from(r"c:\programdata\openframe\meshcentral-agent\agent.exe");
    assert!(image_under_dir(Some(child.as_path()), &tool_dir()));
}

#[test]
fn image_under_dir_matches_nested_child() {
    let child = tool_dir().join("logs").join("agent.log");
    assert!(image_under_dir(Some(child.as_path()), &tool_dir()));
}

#[test]
fn image_not_under_sibling_dir() {
    // A sibling that shares the parent but not the leaf must not count as "under".
    let sibling = tool_dir()
        .parent()
        .unwrap()
        .join("fleetmdm-agent")
        .join("agent.exe");
    assert!(!image_under_dir(Some(sibling.as_path()), &tool_dir()));
}
