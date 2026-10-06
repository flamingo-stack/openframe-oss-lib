//! Windows file lock detection and holder enumeration using the Restart Manager API.

#[cfg(target_os = "windows")]
use std::ffi::OsStr;
#[cfg(target_os = "windows")]
use std::os::windows::ffi::OsStrExt;
#[cfg(target_os = "windows")]
use std::path::{Path, PathBuf};
#[cfg(target_os = "windows")]
use windows::core::{PCWSTR, PWSTR};
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::FILETIME;
#[cfg(target_os = "windows")]
use windows::Win32::System::RestartManager::{
    RmEndSession, RmGetList, RmRegisterResources, RmStartSession, RM_PROCESS_INFO,
    RM_UNIQUE_PROCESS,
};

/// Cap on files registered with Restart Manager for one directory query.
#[cfg(target_os = "windows")]
const MAX_RM_FILES: usize = 1024;

#[cfg(target_os = "windows")]
#[derive(Debug, Clone)]
pub struct LockingProcess {
    pub pid: u32,
    pub name: String,
}

/// A Restart Manager lock holder with the fields needed for safe eviction decisions.
#[cfg(target_os = "windows")]
#[derive(Debug, Clone)]
pub struct LockHolder {
    pub pid: u32,
    pub app_name: String,
    /// Raw `RM_APP_TYPE` (RmCritical == 1000).
    pub app_type: i32,
    pub ts_session_id: u32,
    pub restartable: bool,
    /// Present when Restart Manager classifies the holder as a service.
    pub service_short_name: Option<String>,
}

#[cfg(target_os = "windows")]
impl std::fmt::Display for LockingProcess {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{} (PID: {})", self.name, self.pid)
    }
}

#[cfg(target_os = "windows")]
fn wide(s: &OsStr) -> Vec<u16> {
    s.encode_wide().chain(std::iter::once(0)).collect()
}

#[cfg(target_os = "windows")]
fn decode_utf16(buf: &[u16]) -> String {
    let end = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
    String::from_utf16_lossy(&buf[..end])
}

/// Core Restart Manager query: register the given (NUL-terminated wide) paths and return holders.
#[cfg(target_os = "windows")]
fn query_rm_holders(wide_paths: &[Vec<u16>]) -> Result<Vec<LockHolder>, String> {
    if wide_paths.is_empty() {
        return Ok(vec![]);
    }
    unsafe {
        let mut session_handle: u32 = 0;
        let mut session_key = [0u16; 33]; // CCH_RM_SESSION_KEY + 1

        RmStartSession(&mut session_handle, 0, PWSTR(session_key.as_mut_ptr()))
            .map_err(|e| format!("RmStartSession failed: {:?}", e))?;

        // RAII guard for session cleanup
        struct SessionGuard(u32);
        impl Drop for SessionGuard {
            fn drop(&mut self) {
                unsafe {
                    let _ = RmEndSession(self.0);
                }
            }
        }
        let _guard = SessionGuard(session_handle);

        let ptrs: Vec<PCWSTR> = wide_paths.iter().map(|w| PCWSTR(w.as_ptr())).collect();

        RmRegisterResources(session_handle, Some(&ptrs), None, None)
            .map_err(|e| format!("RmRegisterResources failed: {:?}", e))?;

        let mut needed: u32 = 0;
        let mut count: u32 = 0;
        let mut reboot_reason: u32 = 0;

        // First call to get count (ERROR_MORE_DATA = 234 is expected)
        let first_result = RmGetList(
            session_handle,
            &mut needed,
            &mut count,
            None,
            &mut reboot_reason,
        );

        if let Err(ref e) = first_result {
            if e.code().0 as u32 != 234 {
                return Err(format!("RmGetList (count) failed: {:?}", e));
            }
        }

        if needed == 0 {
            return Ok(vec![]);
        }

        let mut processes: Vec<RM_PROCESS_INFO> = vec![
            RM_PROCESS_INFO {
                Process: RM_UNIQUE_PROCESS {
                    dwProcessId: 0,
                    ProcessStartTime: FILETIME {
                        dwLowDateTime: 0,
                        dwHighDateTime: 0,
                    },
                },
                strAppName: [0; 256],
                strServiceShortName: [0; 64],
                ApplicationType: Default::default(),
                AppStatus: 0,
                TSSessionId: 0,
                bRestartable: Default::default(),
            };
            needed as usize
        ];
        count = needed;

        RmGetList(
            session_handle,
            &mut needed,
            &mut count,
            Some(processes.as_mut_ptr()),
            &mut reboot_reason,
        )
        .map_err(|e| format!("RmGetList (data) failed: {:?}", e))?;

        let holders = processes
            .iter()
            .take(count as usize)
            .map(|p| {
                let service_short_name = {
                    let s = decode_utf16(&p.strServiceShortName);
                    if s.is_empty() {
                        None
                    } else {
                        Some(s)
                    }
                };
                LockHolder {
                    pid: p.Process.dwProcessId,
                    app_name: decode_utf16(&p.strAppName),
                    app_type: p.ApplicationType.0,
                    ts_session_id: p.TSSessionId,
                    restartable: p.bRestartable.as_bool(),
                    service_short_name,
                }
            })
            .collect();

        Ok(holders)
    }
}

/// Returns processes that have the file open (name + PID only).
#[cfg(target_os = "windows")]
pub fn get_locking_processes(file_path: &str) -> Result<Vec<LockingProcess>, String> {
    let wide_path = wide(OsStr::new(file_path));
    let holders = query_rm_holders(std::slice::from_ref(&wide_path))?;
    Ok(holders
        .into_iter()
        .map(|h| LockingProcess {
            pid: h.pid,
            name: h.app_name,
        })
        .collect())
}

/// Enumerate the regular files under `dir` (bounded, recursive).
#[cfg(target_os = "windows")]
fn collect_files(dir: &Path, out: &mut Vec<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        if out.len() >= MAX_RM_FILES {
            return;
        }
        let path = entry.path();
        match entry.file_type() {
            Ok(ft) if ft.is_dir() => collect_files(&path, out),
            Ok(_) => out.push(path),
            Err(_) => {}
        }
    }
}

/// Returns the processes holding any file open under `dir`, with the fields needed to
/// evict them safely. Registers every file under the directory (up to `MAX_RM_FILES`)
/// with a single Restart Manager session.
#[cfg(target_os = "windows")]
pub fn get_directory_lock_holders(dir: &Path) -> Result<Vec<LockHolder>, String> {
    let mut files: Vec<PathBuf> = Vec::new();
    collect_files(dir, &mut files);
    // Fall back to the directory itself when it holds no files (e.g. only subdirectories).
    if files.is_empty() {
        files.push(dir.to_path_buf());
    }

    let wide_paths: Vec<Vec<u16>> = files.iter().map(|p| wide(p.as_os_str())).collect();
    let mut holders = query_rm_holders(&wide_paths)?;

    // Dedupe by PID: a process holding several files appears once per file.
    holders.sort_by_key(|h| h.pid);
    holders.dedup_by_key(|h| h.pid);
    Ok(holders)
}

#[cfg(target_os = "windows")]
pub fn format_locking_processes(processes: &[LockingProcess]) -> String {
    if processes.is_empty() {
        return String::from("No processes detected");
    }
    processes
        .iter()
        .map(|p| format!("{} (PID: {})", p.name, p.pid))
        .collect::<Vec<_>>()
        .join(", ")
}

#[cfg(target_os = "windows")]
pub fn is_file_in_use_error(error: &std::io::Error) -> bool {
    error.raw_os_error() == Some(32) // ERROR_SHARING_VIOLATION
}

/// Logs which processes are locking a file if error is "file in use". Returns true if it was.
#[cfg(target_os = "windows")]
pub fn log_file_lock_info(error: &std::io::Error, file_path: &str, operation: &str) -> bool {
    use tracing::error;

    if !is_file_in_use_error(error) {
        return false;
    }

    match get_locking_processes(file_path) {
        Ok(processes) if !processes.is_empty() => {
            error!(
                "Failed to {}: file '{}' is locked by: {}",
                operation,
                file_path,
                format_locking_processes(&processes)
            );
        }
        Ok(_) => {
            error!(
                "Failed to {}: file '{}' is locked, but could not identify locking process",
                operation, file_path
            );
        }
        Err(lock_err) => {
            error!(
                "Failed to {}: file '{}' is locked, failed to query locking processes: {}",
                operation, file_path, lock_err
            );
        }
    }

    true
}
