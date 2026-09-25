//! Reaps tool helper processes (e.g. Fleet's `osqueryd`) whose parent has died.

use std::collections::HashMap;
use std::path::Path;

use sysinfo::{ProcessRefreshKind, System, UpdateKind};
use tracing::{info, warn};

#[derive(Debug, Clone)]
pub(crate) struct ProcSnapshot {
    pub pid: u32,
    pub exe: Option<String>,
    pub parent: Option<u32>,
    /// Seconds since the epoch.
    pub start_time: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum OrphanReason {
    ParentGone,
    /// The parent pid is alive but belongs to a newer process, so the real parent died.
    ParentPidReused,
    ReparentedToInit,
}

/// Normalizes an executable path for comparison (Windows paths are case-insensitive and may carry `\\?\`).
pub(crate) fn normalize_exe(path: &str, case_insensitive: bool) -> String {
    let trimmed = path.strip_prefix(r"\\?\").unwrap_or(path);
    if case_insensitive {
        trimmed.to_lowercase()
    } else {
        trimmed.to_string()
    }
}

/// Directory part of a path, splitting on either separator so Windows paths work on any host.
fn parent_dir(path: &str) -> &str {
    path.rfind(['/', '\\']).map_or("", |i| &path[..i])
}

/// Picks the processes running `target_exe` whose parent is gone; unknown parents are left alone.
pub(crate) fn select_orphans(
    procs: &[ProcSnapshot],
    target_exe: &str,
    case_insensitive: bool,
) -> Vec<(u32, OrphanReason)> {
    let target = normalize_exe(target_exe, case_insensitive);
    let tool_dir = parent_dir(&target);
    let by_pid: HashMap<u32, &ProcSnapshot> = procs.iter().map(|p| (p.pid, p)).collect();
    // A parent running from the tool dir is our own agent/watcher, even if a clock step skewed start times.
    let in_tool_dir = |p: &ProcSnapshot| {
        p.exe
            .as_deref()
            .is_some_and(|exe| parent_dir(&normalize_exe(exe, case_insensitive)) == tool_dir)
    };

    procs
        .iter()
        .filter(|p| {
            p.exe
                .as_deref()
                .is_some_and(|exe| normalize_exe(exe, case_insensitive) == target)
        })
        .filter_map(|p| {
            let parent = p.parent?;
            let reason = if cfg!(unix) && parent == 1 {
                OrphanReason::ReparentedToInit
            } else {
                match by_pid.get(&parent) {
                    None => OrphanReason::ParentGone,
                    Some(pp) if pp.start_time > p.start_time && !in_tool_dir(pp) => {
                        OrphanReason::ParentPidReused
                    }
                    Some(_) => return None,
                }
            };
            Some((p.pid, reason))
        })
        .collect()
}

/// Kills every orphaned process running `target_exe`; returns how many were killed.
pub fn reap_orphans(target_exe: &Path) -> usize {
    let mut sys = System::new();
    sys.refresh_processes_specifics(ProcessRefreshKind::new().with_exe(UpdateKind::Always));

    let snapshot: Vec<ProcSnapshot> = sys
        .processes()
        .iter()
        .map(|(pid, p)| ProcSnapshot {
            pid: pid.as_u32(),
            exe: p.exe().map(|e| e.to_string_lossy().into_owned()),
            parent: p.parent().map(|pp| pp.as_u32()),
            start_time: p.start_time(),
        })
        .collect();

    let target = target_exe.to_string_lossy();
    let orphans = select_orphans(&snapshot, &target, cfg!(windows));
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let mut killed = 0;
    for (pid, reason) in &orphans {
        let Some(process) = sys.process(sysinfo::Pid::from_u32(*pid)) else {
            continue;
        };
        let age_secs = now.saturating_sub(process.start_time());
        if process.kill() {
            killed += 1;
            info!(pid, ?reason, age_secs, exe = %target, "Killed orphaned tool process");
        } else {
            warn!(pid, ?reason, age_secs, exe = %target, "Failed to kill orphaned tool process");
        }
    }
    if !orphans.is_empty() {
        info!(found = orphans.len(), killed, exe = %target, "Orphaned tool process sweep finished");
    }
    killed
}

#[cfg(test)]
#[path = "orphan_reaper_tests.rs"]
mod tests;
