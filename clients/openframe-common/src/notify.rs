use std::fmt;

#[cfg(target_os = "macos")]
pub mod macos;
pub mod toast;
#[cfg(windows)]
pub mod windows;

#[derive(Debug)]
pub enum Error {
    Unavailable,
    AlreadyInstalled,
    Os(String),
    Io(std::io::Error),
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::Unavailable => f.write_str(
                "OS notifications are unavailable: no bundle identifier, or not installed",
            ),
            Error::AlreadyInstalled => f.write_str("OS notifications are already installed"),
            Error::Os(message) => f.write_str(message),
            Error::Io(err) => err.fmt(f),
        }
    }
}

impl std::error::Error for Error {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Error::Io(err) => Some(err),
            _ => None,
        }
    }
}

impl From<std::io::Error> for Error {
    fn from(err: std::io::Error) -> Self {
        Error::Io(err)
    }
}

pub fn truncate(text: &str, max: usize) -> String {
    if text.chars().count() <= max {
        return text.to_string();
    }
    let mut out: String = text.chars().take(max.saturating_sub(1)).collect();
    out.push('…');
    out
}

#[cfg(test)]
#[path = "notify_tests.rs"]
mod tests;
