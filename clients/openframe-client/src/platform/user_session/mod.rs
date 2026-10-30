#[cfg(target_os = "macos")]
mod macos;
#[cfg(windows)]
mod windows;

#[cfg(target_os = "macos")]
pub use macos::{get_console_user, is_gui_session_ready, is_process_running, launch_as_user};
#[cfg(target_os = "macos")]
pub(crate) use macos::{is_login_user, session_user};

#[cfg(windows)]
pub(crate) use self::windows::{launch_app_in_session, launch_in_user_session, session_user};

/// The user a process's session belongs to; unknown off macOS and Windows.
#[cfg(not(any(target_os = "macos", windows)))]
pub(crate) fn session_user(_session: Option<u32>) -> Option<String> {
    None
}
