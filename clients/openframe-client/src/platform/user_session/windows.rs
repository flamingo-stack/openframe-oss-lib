use crate::utils::windows_helpers::{build_command_line, to_wide, wcslen};
use anyhow::{Context, Result};
use tracing::{error, info, warn};
use windows::{
    core::{PCWSTR, PWSTR},
    Win32::Foundation::*,
    Win32::Security::*,
    Win32::System::RemoteDesktop::*,
    Win32::System::Threading::*,
    Win32::UI::WindowsAndMessaging::SW_SHOW,
};

pub(crate) fn launch_in_user_session(command_path: &str, args: &[String]) -> Result<u32> {
    let session_id = get_active_user_session().context("No active user session found")?;
    let (pid, process_handle) = launch_process_in_target_session(command_path, args, session_id)?;
    unsafe {
        let _ = CloseHandle(process_handle);
    }
    Ok(pid)
}

fn get_active_user_session() -> Option<u32> {
    unsafe {
        info!("=== Starting active user session detection ===");

        // 1. Try to get Session Id of current process
        let current_pid = GetCurrentProcessId();
        info!("Current process PID: {}", current_pid);

        let mut session_id = 0;
        if ProcessIdToSessionId(current_pid, &mut session_id).is_ok() {
            info!("Current process session ID: {}", session_id);
            if session_id != 0 {
                info!(
                    "Not running as service - using current process session ID: {}",
                    session_id
                );
                return Some(session_id);
            }
            info!("Session ID is 0 - running as service, need to find active user session");
        } else {
            warn!("Failed to get current process session ID");
        }

        // 2. If session_id == 0 (service), enumerate all sessions to find active user
        info!("Enumerating all Windows Terminal Services sessions...");
        let mut pp_session_info: *mut WTS_SESSION_INFOW = std::ptr::null_mut();
        let mut count: u32 = 0;

        if WTSEnumerateSessionsW(
            WTS_CURRENT_SERVER_HANDLE,
            0,
            1,
            &mut pp_session_info,
            &mut count,
        )
        .is_ok()
        {
            info!("Found {} total sessions", count);
            let sessions = std::slice::from_raw_parts(pp_session_info, count as usize);

            // First, log ALL sessions for visibility
            let mut active_sessions = Vec::new();

            for (idx, session) in sessions.iter().enumerate() {
                let session_name = if session.pWinStationName.is_null() {
                    String::from("(null)")
                } else {
                    String::from_utf16_lossy(std::slice::from_raw_parts(
                        session.pWinStationName.0,
                        wcslen(session.pWinStationName.0),
                    ))
                };

                info!(
                    "  Session {}: ID={}, Name='{}', State={:?}",
                    idx, session.SessionId, session_name, session.State
                );

                // Collect all active sessions (State == 0 = WTSActive)
                if session.State == WTSActive {
                    active_sessions.push((session.SessionId, session_name.clone()));
                    info!("    → Active session detected");
                }
            }

            // Choose the best active session
            if !active_sessions.is_empty() {
                info!("Found {} active session(s)", active_sessions.len());

                // Strategy: Prefer RDP sessions over Console, or use the highest session ID (most recent)
                let best_session = active_sessions
                    .iter()
                    .filter(|(id, name)| {
                        // Filter out session 0 (Services) and listen sessions
                        *id > 0 && !name.to_lowercase().contains("listen")
                    })
                    .max_by_key(|(id, name)| {
                        // Prefer RDP sessions (rdp-tcp) over Console, then by highest ID
                        let is_rdp = name.to_lowercase().contains("rdp-tcp");
                        let is_console = name.to_lowercase().contains("console");

                        // Priority: RDP > Console, then by session ID
                        if is_rdp && !name.to_lowercase().contains("listen") {
                            (2, *id) // Highest priority for active RDP sessions
                        } else if is_console {
                            (1, *id) // Medium priority for console
                        } else {
                            (0, *id) // Lowest priority for others
                        }
                    });

                if let Some((id, name)) = best_session {
                    info!("Selected active user session: ID={}, Name='{}'", id, name);
                    WTSFreeMemory(pp_session_info as _);
                    return Some(*id);
                } else {
                    warn!("Active sessions found but none suitable (filtered out session 0 and listen sessions)");
                }
            } else {
                warn!(
                    "No active (WTSActive) session found among {} sessions",
                    count
                );
            }

            WTSFreeMemory(pp_session_info as _);
        } else {
            error!("Failed to enumerate Windows Terminal Services sessions");
        }

        error!("=== Failed to find any active user session ===");
        None
    }
}

fn launch_process_in_target_session(
    command_path: &str,
    args: &[String],
    session_id: u32,
) -> Result<(u32, HANDLE)> {
    unsafe {
        info!("Step 1: Querying user token for session {}", session_id);
        let mut user_token = HANDLE(0);
        if let Err(e) = WTSQueryUserToken(session_id, &mut user_token) {
            error!(
                "Failed to get user token for session {}: {:?}",
                session_id, e
            );
            anyhow::bail!(
                "Failed to get user token for session {}: {:?}",
                session_id,
                e
            );
        }

        info!(
            "Successfully obtained user token for session {} (handle: {:?})",
            session_id, user_token
        );

        // Duplicate token to get primary token (required for CreateProcessAsUserW)
        info!("Step 2: Duplicating token to get primary token (required for CreateProcessAsUserW)");
        let mut primary_token = HANDLE(0);
        if let Err(e) = DuplicateTokenEx(
            user_token,
            TOKEN_ALL_ACCESS,
            None,
            SECURITY_IMPERSONATION_LEVEL(2), // SecurityImpersonation
            TokenPrimary,
            &mut primary_token,
        ) {
            error!("Failed to duplicate token: {:?}", e);
            let _ = CloseHandle(user_token);
            anyhow::bail!(
                "Failed to duplicate token for session {}: {:?}",
                session_id,
                e
            );
        }

        let _ = CloseHandle(user_token);
        info!(
            "Successfully duplicated token to primary token (handle: {:?})",
            primary_token
        );

        // Build command line with full path in quotes + arguments
        info!("Step 3: Building command line");
        let cmdline = build_command_line(command_path, args);
        info!("Command line: {}", cmdline);

        info!("Step 4: Setting up STARTUPINFOW structure");
        // For GUI applications, set the desktop to winsta0\default
        let desktop = to_wide("winsta0\\default");
        let mut si = STARTUPINFOW {
            cb: std::mem::size_of::<STARTUPINFOW>() as u32,
            lpDesktop: PWSTR(desktop.as_ptr() as *mut u16),
            dwFlags: windows::Win32::System::Threading::STARTF_USESHOWWINDOW,
            wShowWindow: SW_SHOW.0 as u16,
            ..Default::default()
        };
        info!("  Desktop: winsta0\\default");
        info!("  Show window: SW_SHOW");
        info!("  STARTUPINFOW size: {} bytes", si.cb);

        let mut pi = PROCESS_INFORMATION::default();

        let mut cmdline_wide = to_wide(&cmdline);

        info!("Step 5: Calling CreateProcessAsUserW");
        info!("  lpApplicationName: NULL (using command line parsing)");
        info!("  lpCommandLine: {}", cmdline);
        info!("  Creation flags: CREATE_NEW_PROCESS_GROUP");

        // For GUI applications, use CREATE_NEW_PROCESS_GROUP for proper process isolation
        use windows::Win32::System::Threading::CREATE_NEW_PROCESS_GROUP;

        // Try with lpApplicationName = NULL and full command line
        let result = CreateProcessAsUserW(
            primary_token,
            PCWSTR::null(), // lpApplicationName = NULL
            PWSTR(cmdline_wide.as_mut_ptr()),
            None,
            None,
            false,
            CREATE_NEW_PROCESS_GROUP,
            None,
            None,
            &si,
            &mut pi,
        );

        if let Err(e) = result {
            // Fallback: try without desktop specification
            error!(
                "✗ CreateProcessAsUserW failed with desktop specification: {:?}",
                e
            );
            warn!("Attempting fallback: retrying without desktop specification");

            info!("Step 6: Fallback attempt - removing desktop specification");
            si.lpDesktop = PWSTR::null();
            info!("  Desktop: NULL (removed)");
            let mut cmdline_wide_retry = to_wide(&cmdline);

            let result_retry = CreateProcessAsUserW(
                primary_token,
                PCWSTR::null(),
                PWSTR(cmdline_wide_retry.as_mut_ptr()),
                None,
                None,
                false,
                CREATE_NEW_PROCESS_GROUP,
                None,
                None,
                &si,
                &mut pi,
            );

            let _ = CloseHandle(primary_token);

            if let Err(e2) = result_retry {
                error!(
                    "✗ CreateProcessAsUserW failed again without desktop specification: {:?}",
                    e2
                );
                error!("Both attempts to launch process failed");
                anyhow::bail!("Failed to launch process in user session: {:?}", e2);
            }

            info!("Fallback successful - process launched without desktop specification");
        } else {
            info!("CreateProcessAsUserW succeeded on first attempt");
            let _ = CloseHandle(primary_token);
        }

        let pid = pi.dwProcessId;
        let process_handle = pi.hProcess;

        info!("Step 7: Process created successfully");
        info!("  Process ID (PID): {}", pid);
        info!("  Process handle: {:?}", process_handle);
        info!("  Thread ID: {}", pi.dwThreadId);
        info!("  Thread handle: {:?}", pi.hThread);

        // Close thread handle as we don't need it
        let _ = CloseHandle(pi.hThread);
        info!("  Closed thread handle (not needed for monitoring)");

        info!(
            "=== Process launched successfully in user session {} with PID {} ===",
            session_id, pid
        );
        Ok((pid, process_handle))
    }
}
