use std::path::PathBuf;

/// Get the Windows PowerShell path the same way RMM scripts run it: the absolute
/// System32 binary, so a PATH entry can't shadow it and security tools that allow
/// PowerShell by path match it. Falls back to the bare name.
#[cfg(windows)]
pub fn get_powershell_path() -> String {
    resolve_system32_exe(
        r"System32\WindowsPowerShell\v1.0\powershell.exe",
        "powershell.exe",
    )
}

/// Absolute path of a System32 executable under %WINDIR%, or `bare` when it is missing.
#[cfg(windows)]
pub fn resolve_system32_exe(system32_rel: &str, bare: &str) -> String {
    let windir = std::env::var_os("WINDIR")
        .or_else(|| std::env::var_os("SystemRoot"))
        .map(PathBuf::from);
    if let Some(windir) = windir {
        let abs = windir.join(system32_rel);
        if abs.is_file() {
            return abs.to_string_lossy().into_owned();
        }
    }
    bare.to_string()
}
