//! Lock-aware recovery for a tool directory Windows refuses to delete because a process holds
//! a file open without `FILE_SHARE_DELETE` (`ERROR_SHARING_VIOLATION`, os error 32).
//!
//! The classifier is tool-generic and platform-independent (unit-tested everywhere); the
//! eviction and delete-on-reboot machinery is Windows-only.

#[cfg(any(target_os = "windows", test))]
use std::collections::HashSet;
#[cfg(any(target_os = "windows", test))]
use std::path::{Component, Path, PathBuf};

/// Image names that must never be terminated: killing one destabilizes or bugchecks the host.
#[cfg(any(target_os = "windows", test))]
const CRITICAL_PROCESS_NAMES: &[&str] = &[
    "system",
    "services.exe",
    "svchost.exe",
    "lsass.exe",
    "csrss.exe",
    "wininit.exe",
    "smss.exe",
    "winlogon.exe",
];

/// Orphan-shell class we auto-terminate when it is the one holding the tool dir open.
#[cfg(any(target_os = "windows", test))]
const EVICTABLE_SHELL_NAMES: &[&str] = &["cmd.exe", "powershell.exe", "pwsh.exe", "conhost.exe"];

/// `RM_APP_TYPE` value for a system-critical process.
#[cfg(any(target_os = "windows", test))]
const RM_CRITICAL_APP_TYPE: i32 = 1000;

/// What to do with a single lock holder.
#[cfg(any(target_os = "windows", test))]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum HolderAction {
    /// Force-terminate the process (orphan shell, or a stray process under the tool dir).
    Terminate,
    /// Stop it through the service control manager, not by killing the process.
    StopService,
    /// Leave it alone (critical, protected, foreign, or unknown).
    Skip,
}

/// A Restart Manager holder enriched with the process facts the decision needs.
#[cfg(any(target_os = "windows", test))]
#[derive(Debug, Clone)]
pub(crate) struct EnrichedHolder {
    pub pid: u32,
    /// Lowercased executable file name (e.g. `cmd.exe`); falls back to the RM app name.
    pub proc_name: String,
    pub image_path: Option<PathBuf>,
    /// Raw `RM_APP_TYPE`.
    pub app_type: i32,
    /// Present when Restart Manager classified the holder as a service.
    pub service_short_name: Option<String>,
}

/// Case-insensitive file-name match against a lowercase allowlist.
#[cfg(any(target_os = "windows", test))]
fn name_matches(name: &str, list: &[&str]) -> bool {
    let file = Path::new(name)
        .file_name()
        .and_then(|f| f.to_str())
        .unwrap_or(name)
        .to_ascii_lowercase();
    list.iter().any(|c| file == *c)
}

/// Windows paths are case-insensitive, so compare components ASCII-case-insensitively.
#[cfg(any(target_os = "windows", test))]
fn component_eq(a: &Component, b: &Component) -> bool {
    a.as_os_str().eq_ignore_ascii_case(b.as_os_str())
}

/// True when `child` is `base` itself or lies beneath it.
#[cfg(any(target_os = "windows", test))]
fn path_under(child: &Path, base: &Path) -> bool {
    let mut c = child.components();
    for b in base.components() {
        match c.next() {
            Some(cc) if component_eq(&cc, &b) => {}
            _ => return false,
        }
    }
    true
}

#[cfg(any(target_os = "windows", test))]
fn image_under_dir(image: Option<&Path>, tool_dir: &Path) -> bool {
    image.map(|i| path_under(i, tool_dir)).unwrap_or(false)
}

/// Decide what to do with one holder of a file under `tool_dir`. Encodes the hard kill-safety
/// rules: never the idle/system PIDs, this process or its ancestors, `RmCritical`, or a critical
/// system process; SCM-stop only a service whose binary is the tool being removed; terminate the
/// orphan-shell class and stray processes running from under the tool dir; skip everything else.
#[cfg(any(target_os = "windows", test))]
pub(crate) fn classify_holder(
    h: &EnrichedHolder,
    tool_dir: &Path,
    protected_pids: &HashSet<u32>,
) -> HolderAction {
    if h.pid == 0 || h.pid == 4 {
        return HolderAction::Skip;
    }
    if protected_pids.contains(&h.pid) {
        return HolderAction::Skip;
    }
    if h.app_type == RM_CRITICAL_APP_TYPE || name_matches(&h.proc_name, CRITICAL_PROCESS_NAMES) {
        return HolderAction::Skip;
    }

    let under = image_under_dir(h.image_path.as_deref(), tool_dir);

    if h.service_short_name.is_some() {
        // Only touch a service that belongs to the tool being removed; never a foreign one.
        return if under {
            HolderAction::StopService
        } else {
            HolderAction::Skip
        };
    }

    if name_matches(&h.proc_name, EVICTABLE_SHELL_NAMES) || under {
        return HolderAction::Terminate;
    }

    HolderAction::Skip
}

// ---------------------------------------------------------------------------
// Windows-only eviction + delete-on-reboot
// ---------------------------------------------------------------------------

#[cfg(target_os = "windows")]
use crate::platform::file_lock::{get_directory_lock_holders, LockHolder};
#[cfg(target_os = "windows")]
use crate::platform::system_service;
#[cfg(target_os = "windows")]
use sysinfo::{Pid, System};
#[cfg(target_os = "windows")]
use tracing::{info, warn};
#[cfg(target_os = "windows")]
use windows::core::PCWSTR;
#[cfg(target_os = "windows")]
use windows::Win32::Storage::FileSystem::{MoveFileExW, MOVEFILE_DELAY_UNTIL_REBOOT};

/// Depth of the ancestor walk when building the protected-PID set (guards against cycles).
#[cfg(target_os = "windows")]
const MAX_ANCESTOR_HOPS: usize = 64;

/// Build the enriched holders and the protected-PID set (this process + its ancestor chain)
/// from a live process snapshot.
#[cfg(target_os = "windows")]
fn enrich_and_protect(holders: Vec<LockHolder>) -> (Vec<EnrichedHolder>, HashSet<u32>) {
    // new_all() already loads process info, so no extra refresh is needed.
    let sys = System::new_all();

    let mut protected: HashSet<u32> = HashSet::new();
    let mut current = Some(Pid::from_u32(std::process::id()));
    for _ in 0..MAX_ANCESTOR_HOPS {
        let Some(pid) = current else { break };
        if !protected.insert(pid.as_u32()) {
            break;
        }
        current = sys.process(pid).and_then(|p| p.parent());
    }

    let enriched = holders
        .into_iter()
        .map(|h| {
            let proc = sys.process(Pid::from_u32(h.pid));
            let image_path = proc.and_then(|p| p.exe()).map(|p| p.to_path_buf());
            let proc_name = image_path
                .as_deref()
                .and_then(|p| p.file_name())
                .and_then(|f| f.to_str())
                .map(|s| s.to_ascii_lowercase())
                .or_else(|| proc.map(|p| p.name().to_ascii_lowercase()))
                .unwrap_or_else(|| h.app_name.to_ascii_lowercase());
            EnrichedHolder {
                pid: h.pid,
                proc_name,
                image_path,
                app_type: h.app_type,
                service_short_name: h.service_short_name,
            }
        })
        .collect();

    (enriched, protected)
}

/// Identify the processes locking files under `tool_dir`, report them, and evict the ones that
/// are safe to remove. Best-effort: it logs and returns rather than failing the removal.
#[cfg(target_os = "windows")]
pub(crate) async fn evict_holders_for_removal(tool_dir: &Path) {
    let dir = tool_dir.to_path_buf();
    let holders = match tokio::task::spawn_blocking(move || get_directory_lock_holders(&dir)).await
    {
        Ok(Ok(holders)) => holders,
        Ok(Err(e)) => {
            warn!(
                "Lock recovery: Restart Manager query failed for {}: {}",
                tool_dir.display(),
                e
            );
            return;
        }
        Err(e) => {
            warn!(
                "Lock recovery: holder-query task failed for {}: {}",
                tool_dir.display(),
                e
            );
            return;
        }
    };

    if holders.is_empty() {
        info!(
            "Lock recovery: no Restart Manager holders under {}",
            tool_dir.display()
        );
        return;
    }

    // Report every holder before taking any action (ships to Loki).
    for h in &holders {
        info!(
            pid = h.pid,
            app_name = %h.app_name,
            app_type = h.app_type,
            ts_session_id = h.ts_session_id,
            restartable = h.restartable,
            service = %h.service_short_name.as_deref().unwrap_or(""),
            "Lock recovery: holder of {}",
            tool_dir.display()
        );
    }

    let (enriched, protected) =
        match tokio::task::spawn_blocking(move || enrich_and_protect(holders)).await {
            Ok(result) => result,
            Err(e) => {
                warn!("Lock recovery: enrichment task failed: {}", e);
                return;
            }
        };

    let mut to_terminate: Vec<u32> = Vec::new();
    let mut to_stop_service: Vec<String> = Vec::new();

    for h in &enriched {
        let action = classify_holder(h, tool_dir, &protected);
        info!(
            pid = h.pid,
            name = %h.proc_name,
            image = %h.image_path.as_deref().map(|p| p.display().to_string()).unwrap_or_default(),
            action = ?action,
            "Lock recovery: decision for holder"
        );
        match action {
            HolderAction::Terminate => to_terminate.push(h.pid),
            HolderAction::StopService => {
                if let Some(svc) = &h.service_short_name {
                    to_stop_service.push(svc.clone());
                }
            }
            HolderAction::Skip => {}
        }
    }

    for svc in to_stop_service {
        info!("Lock recovery: stopping service holder {} via SCM", svc);
        if let Err(e) = system_service::stop_service(&svc, false).await {
            warn!("Lock recovery: failed to stop service {}: {:#}", svc, e);
        }
    }

    for pid in to_terminate {
        terminate_pid(pid).await;
    }

    // Let the OS release the handles before the caller retries the removal.
    tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
}

#[cfg(target_os = "windows")]
async fn terminate_pid(pid: u32) {
    info!("Lock recovery: terminating lock holder PID {}", pid);
    match tokio::process::Command::new("taskkill")
        .args(["/F", "/T", "/PID", &pid.to_string()])
        .output()
        .await
    {
        Ok(out) if !out.status.success() => warn!(
            "Lock recovery: taskkill for PID {} reported: {}",
            pid,
            String::from_utf8_lossy(&out.stderr).trim()
        ),
        Ok(_) => {}
        Err(e) => warn!(
            "Lock recovery: failed to run taskkill for PID {}: {}",
            pid, e
        ),
    }
}

/// Schedule every entry under `dir` (and `dir` itself) for deletion on the next boot via
/// `MoveFileEx`, so a directory a refused holder still locks is cleared without a manual wipe.
/// Returns the number of entries scheduled.
#[cfg(target_os = "windows")]
pub(crate) fn schedule_delete_on_reboot(dir: &Path) -> usize {
    let mut files: Vec<PathBuf> = Vec::new();
    let mut dirs: Vec<PathBuf> = Vec::new();
    collect_entries(dir, &mut files, &mut dirs);
    dirs.push(dir.to_path_buf());
    // Deepest first, so each directory is empty when its own deletion is applied at boot.
    dirs.sort_by_key(|d| std::cmp::Reverse(d.components().count()));

    let mut scheduled = 0usize;
    for file in &files {
        if move_delete_on_reboot(file) {
            scheduled += 1;
        }
    }
    for directory in &dirs {
        if move_delete_on_reboot(directory) {
            scheduled += 1;
        }
    }
    scheduled
}

#[cfg(target_os = "windows")]
fn collect_entries(dir: &Path, files: &mut Vec<PathBuf>, dirs: &mut Vec<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        match entry.file_type() {
            Ok(ft) if ft.is_dir() => {
                collect_entries(&path, files, dirs);
                dirs.push(path);
            }
            Ok(_) => files.push(path),
            Err(_) => {}
        }
    }
}

#[cfg(target_os = "windows")]
fn move_delete_on_reboot(path: &Path) -> bool {
    use std::os::windows::ffi::OsStrExt;
    let wide: Vec<u16> = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    // A NULL destination with MOVEFILE_DELAY_UNTIL_REBOOT marks the path for deletion at boot.
    unsafe {
        MoveFileExW(
            PCWSTR(wide.as_ptr()),
            PCWSTR(std::ptr::null()),
            MOVEFILE_DELAY_UNTIL_REBOOT,
        )
        .is_ok()
    }
}

#[cfg(test)]
#[path = "lock_recovery_tests.rs"]
mod tests;
