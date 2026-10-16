#[cfg(target_os = "macos")]
mod macos;
#[cfg(windows)]
mod windows;

#[cfg(target_os = "macos")]
pub use macos::{
    console_logon_id, get_console_user, is_gui_session_ready, is_process_running, launch_as_user,
};

#[cfg(windows)]
pub use self::windows::console_logon_id;
#[cfg(windows)]
pub(crate) use self::windows::launch_in_user_session;

#[cfg(not(any(windows, target_os = "macos")))]
pub fn console_logon_id() -> Option<u64> {
    None
}
