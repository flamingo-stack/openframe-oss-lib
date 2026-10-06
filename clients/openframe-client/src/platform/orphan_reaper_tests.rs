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

#[test]
fn live_older_parent_outside_the_tool_dir_is_kept() {
    let procs = vec![
        proc(
            10,
            r"C:\Program Files\OpenFrame\openframe-client.exe",
            Some(4),
            100,
        ),
        proc(11, OSQUERYD, Some(10), 105),
    ];
    assert!(select_orphans(&procs, OSQUERYD, true).is_empty());
}

#[test]
fn same_second_parent_outside_the_tool_dir_is_kept() {
    let procs = vec![
        proc(
            10,
            r"C:\Program Files\OpenFrame\openframe-client.exe",
            Some(4),
            105,
        ),
        proc(11, OSQUERYD, Some(10), 105),
    ];
    assert!(select_orphans(&procs, OSQUERYD, true).is_empty());
}

#[test]
fn unreadable_child_start_time_is_never_a_reuse() {
    let procs = vec![
        proc(
            10,
            r"C:\Program Files\OpenFrame\openframe-client.exe",
            Some(4),
            100,
        ),
        proc(11, OSQUERYD, Some(10), 0),
    ];
    assert!(select_orphans(&procs, OSQUERYD, true).is_empty());
}

#[test]
fn newer_parent_without_exe_counts_as_reused() {
    let procs = vec![
        ProcSnapshot {
            pid: 10,
            exe: None,
            parent: Some(4),
            start_time: 200,
        },
        proc(11, OSQUERYD, Some(10), 105),
    ];
    assert_eq!(
        select_orphans(&procs, OSQUERYD, true),
        vec![(11, OrphanReason::ParentPidReused)]
    );
}

#[test]
fn clock_skewed_unix_parent_from_the_tool_dir_is_kept() {
    let target = "/Library/Application Support/OpenFrame/fleetmdm-agent/osqueryd";
    let procs = vec![
        proc(
            10,
            "/Library/Application Support/OpenFrame/fleetmdm-agent/agent",
            Some(5),
            200,
        ),
        proc(11, target, Some(10), 105),
    ];
    assert!(select_orphans(&procs, target, false).is_empty());
}

#[test]
#[ignore = "helper process spawned by reap_orphans_kills_only_orphans_of_the_target_binary"]
fn sleeping_helper() {
    std::thread::sleep(std::time::Duration::from_secs(60));
}

#[cfg(unix)]
#[test]
fn reap_orphans_kills_only_orphans_of_the_target_binary() {
    use std::process::{Command, Stdio};

    let dir = std::env::temp_dir().join(format!("orphan-reaper-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let target = dir.join("osqueryd");
    // A copy of this test binary running `sleeping_helper` stands in for osqueryd.
    let this = std::env::current_exe().unwrap();
    if std::fs::hard_link(&this, &target).is_err() {
        std::fs::copy(&this, &target).unwrap();
    }
    let helper_args = "--ignored --exact platform::orphan_reaper::tests::sleeping_helper";

    // Orphan: started by a shell that exits at once, so it is reparented to init.
    let out = Command::new("/bin/sh")
        .arg("-c")
        .arg(format!(
            "'{}' {helper_args} > /dev/null 2>&1 & echo $!",
            target.display()
        ))
        .output()
        .unwrap();
    let orphan: u32 = String::from_utf8_lossy(&out.stdout).trim().parse().unwrap();
    // Kept: its parent (this test) is alive.
    let mut live = Command::new(&target)
        .args(helper_args.split(' '))
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .unwrap();

    let mut killed = 0;
    for _ in 0..30 {
        std::thread::sleep(std::time::Duration::from_millis(100));
        killed = reap_orphans(&target);
        if killed > 0 {
            break;
        }
    }
    let orphan_gone = (0..30).any(|_| {
        std::thread::sleep(std::time::Duration::from_millis(100));
        unsafe { libc::kill(orphan as i32, 0) != 0 }
    });
    let live_survived = live.try_wait().unwrap().is_none();
    let _ = live.kill();
    let _ = live.wait();
    unsafe {
        libc::kill(orphan as i32, libc::SIGKILL);
    }
    let _ = std::fs::remove_dir_all(&dir);

    assert_eq!(killed, 1, "exactly the orphan should be killed");
    assert!(orphan_gone, "orphan {orphan} is still running");
    assert!(live_survived, "a process with a live parent was killed");
}
