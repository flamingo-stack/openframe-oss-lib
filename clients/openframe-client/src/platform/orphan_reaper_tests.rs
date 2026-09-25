use super::*;

const OSQUERYD: &str = r"C:\ProgramData\OpenFrame\fleetmdm-agent\osqueryd.exe";

fn proc(pid: u32, exe: &str, parent: Option<u32>, start_time: u64) -> ProcSnapshot {
    ProcSnapshot {
        pid,
        exe: Some(exe.to_string()),
        parent,
        start_time,
    }
}

#[test]
fn osqueryd_with_live_parent_is_kept() {
    let procs = vec![
        proc(
            10,
            r"C:\ProgramData\OpenFrame\fleetmdm-agent\agent.exe",
            Some(4),
            100,
        ),
        proc(11, OSQUERYD, Some(10), 105),
    ];
    assert!(select_orphans(&procs, OSQUERYD, true).is_empty());
}

#[test]
fn osqueryd_with_exited_parent_is_reaped() {
    let procs = vec![proc(11, OSQUERYD, Some(10), 105)];
    assert_eq!(
        select_orphans(&procs, OSQUERYD, true),
        vec![(11, OrphanReason::ParentGone)]
    );
}

#[test]
fn reused_parent_pid_counts_as_orphan() {
    let procs = vec![
        proc(10, r"C:\Windows\System32\notepad.exe", Some(4), 200),
        proc(11, OSQUERYD, Some(10), 105),
    ];
    assert_eq!(
        select_orphans(&procs, OSQUERYD, true),
        vec![(11, OrphanReason::ParentPidReused)]
    );
}

#[test]
fn parent_started_in_same_second_is_kept() {
    let procs = vec![
        proc(
            10,
            r"C:\ProgramData\OpenFrame\fleetmdm-agent\agent.exe",
            Some(4),
            105,
        ),
        proc(11, OSQUERYD, Some(10), 105),
    ];
    assert!(select_orphans(&procs, OSQUERYD, true).is_empty());
}

#[test]
fn unknown_parent_is_kept() {
    let procs = vec![proc(11, OSQUERYD, None, 105)];
    assert!(select_orphans(&procs, OSQUERYD, true).is_empty());
}

#[test]
fn osqueryd_outside_the_tool_dir_is_never_touched() {
    let procs = vec![proc(
        11,
        r"C:\Program Files\osquery\osqueryd\osqueryd.exe",
        Some(10),
        105,
    )];
    assert!(select_orphans(&procs, OSQUERYD, true).is_empty());
}

#[test]
fn process_without_exe_is_never_touched() {
    let procs = vec![ProcSnapshot {
        pid: 11,
        exe: None,
        parent: Some(10),
        start_time: 105,
    }];
    assert!(select_orphans(&procs, OSQUERYD, true).is_empty());
}

#[test]
fn windows_path_match_ignores_case_and_verbatim_prefix() {
    let procs = vec![proc(
        11,
        r"\\?\c:\programdata\openframe\FLEETMDM-AGENT\OSQUERYD.EXE",
        Some(10),
        105,
    )];
    assert_eq!(select_orphans(&procs, OSQUERYD, true).len(), 1);
}

#[test]
fn unix_path_match_is_case_sensitive() {
    let target = "/Library/Application Support/OpenFrame/fleetmdm-agent/osqueryd";
    let procs = vec![proc(
        11,
        "/Library/Application Support/OpenFrame/FLEETMDM-AGENT/osqueryd",
        Some(10),
        105,
    )];
    assert!(select_orphans(&procs, target, false).is_empty());
}

#[cfg(unix)]
#[test]
fn unix_orphan_reparented_to_init_is_reaped() {
    let target = "/Library/Application Support/OpenFrame/fleetmdm-agent/osqueryd";
    let procs = vec![
        proc(1, "/sbin/launchd", Some(0), 1),
        proc(11, target, Some(1), 105),
    ];
    assert_eq!(
        select_orphans(&procs, target, false),
        vec![(11, OrphanReason::ReparentedToInit)]
    );
}

#[test]
fn only_orphans_are_selected_from_a_mixed_list() {
    let procs = vec![
        proc(
            10,
            r"C:\ProgramData\OpenFrame\fleetmdm-agent\agent.exe",
            Some(4),
            100,
        ),
        proc(11, OSQUERYD, Some(10), 105),
        proc(12, OSQUERYD, Some(50), 60),
        proc(13, OSQUERYD, Some(51), 70),
    ];
    let mut pids: Vec<u32> = select_orphans(&procs, OSQUERYD, true)
        .into_iter()
        .map(|(pid, _)| pid)
        .collect();
    pids.sort();
    assert_eq!(pids, vec![12, 13]);
}

#[test]
fn clock_skewed_parent_from_the_tool_dir_is_kept() {
    let procs = vec![
        proc(10, OSQUERYD, Some(9), 200),
        proc(11, OSQUERYD, Some(10), 105),
    ];
    assert!(select_orphans(&procs, OSQUERYD, true)
        .iter()
        .all(|(pid, _)| *pid != 11));
}
