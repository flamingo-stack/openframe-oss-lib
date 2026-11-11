mod env;
mod output;
mod tempfile;

#[cfg(unix)]
mod unix;
#[cfg(windows)]
pub(crate) mod windows;

#[cfg(unix)]
pub(crate) use unix::console_user_present;
#[cfg(unix)]
pub use unix::execute_script;
#[cfg(windows)]
pub use windows::execute_script;
#[cfg(windows)]
pub(crate) use windows::{cannot_elevate, console_user_present};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Privilege {
    Agent,
    User,
    #[cfg(windows)]
    ElevatedUser,
}

pub struct ScriptParams<'a> {
    pub code: &'a str,
    pub shell: &'a str,
    pub args: &'a [String],
    pub timeout_secs: u32,
    pub privilege: Privilege,
    pub env_vars: &'a [String],
}

pub struct ExecResult {
    pub stdout: String,
    pub stderr: String,
    pub retcode: i32,
    pub timed_out: bool,
    pub agent_failure: Option<AgentFailure>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AgentFailure {
    NoUserSession,
    CouldNotLaunch,
}

#[derive(Debug, thiserror::Error)]
#[error("{0}")]
pub(crate) struct NoInteractiveUser(pub &'static str);

impl ExecResult {
    pub(crate) fn not_launched(e: anyhow::Error) -> Self {
        let agent_failure = if e.is::<NoInteractiveUser>() {
            AgentFailure::NoUserSession
        } else {
            AgentFailure::CouldNotLaunch
        };
        Self {
            stdout: String::new(),
            stderr: e.to_string(),
            retcode: 85,
            timed_out: false,
            agent_failure: Some(agent_failure),
        }
    }
}
