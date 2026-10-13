use clap::ValueEnum;

/// Remote access mode an install command can preset as the device's override.
#[derive(Debug, Clone, Copy, PartialEq, Eq, ValueEnum)]
pub enum RemoteAccessMode {
    ApprovalRequired,
    NotifyOnly,
    SilentAccess,
    DenyAccess,
}

impl RemoteAccessMode {
    /// The backend's name for the mode, which is also what the install configuration persists.
    pub fn as_wire(self) -> &'static str {
        match self {
            Self::ApprovalRequired => "APPROVAL_REQUIRED",
            Self::NotifyOnly => "NOTIFY_ONLY",
            Self::SilentAccess => "SILENT_ACCESS",
            Self::DenyAccess => "DENY_ACCESS",
        }
    }
}

#[cfg(test)]
#[path = "remote_access_mode_tests.rs"]
mod tests;
