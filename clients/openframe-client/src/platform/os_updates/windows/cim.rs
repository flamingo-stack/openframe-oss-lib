use std::io::Read;
use std::os::windows::process::CommandExt;
use std::process::{Command, Stdio};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use serde::de::DeserializeOwned;

use super::model::{BitLockerFacts, ReadError, Reading, WriteFilterFacts};
use crate::platform::powershell::get_powershell_path;

const CREATE_NO_WINDOW: u32 = 0x0800_0000;
const TIMEOUT: Duration = Duration::from_secs(30);
const POLL_INTERVAL: Duration = Duration::from_millis(100);
const BITLOCKER_SCRIPT: &str = concat!(
    "$ErrorActionPreference = 'Stop'; ",
    "try { $v = Get-CimInstance -Namespace root/CIMV2/Security/MicrosoftVolumeEncryption ",
    "-ClassName Win32_EncryptableVolume -Filter ('DriveLetter=''' + $env:SystemDrive + '''') } ",
    "catch { if ($_.Exception.NativeErrorCode -eq 'InvalidNamespace') { 'null'; exit 0 }; throw }; ",
    "if (-not $v) { 'null'; exit 0 }; ",
    "$s = (Invoke-CimMethod -InputObject $v -MethodName GetProtectionStatus).ProtectionStatus; ",
    "$ids = @((Invoke-CimMethod -InputObject $v -MethodName GetKeyProtectors ",
    "-Arguments @{ KeyProtectorType = [uint32]0 }).VolumeKeyProtectorID); ",
    "$t = @($ids | Where-Object { $_ } | ForEach-Object { [uint32](Invoke-CimMethod -InputObject $v ",
    "-MethodName GetKeyProtectorType -Arguments @{ VolumeKeyProtectorID = $_ }).KeyProtectorType }); ",
    "ConvertTo-Json -Compress -InputObject @{ mountPoint = [string]$v.DriveLetter; ",
    "protectionStatus = [uint32]$s; protectorTypes = $t }",
);
const WRITE_FILTER_SCRIPT: &str = concat!(
    "$ErrorActionPreference = 'Stop'; ",
    "$f = @(Get-CimInstance -Namespace root/standardcimv2/embedded -ClassName UWF_Filter) ",
    "| Select-Object -First 1; ",
    "if (-not $f) { throw 'UWF_Filter has no instance' }; ",
    "ConvertTo-Json -Compress -InputObject @{ currentEnabled = [bool]$f.CurrentEnabled; ",
    "nextEnabled = [bool]$f.NextEnabled }",
);

pub(super) fn bitlocker() -> Reading<Option<BitLockerFacts>> {
    run("BitLocker", BITLOCKER_SCRIPT, TIMEOUT)
}

pub(super) fn write_filter() -> Reading<WriteFilterFacts> {
    run("UWF_Filter", WRITE_FILTER_SCRIPT, TIMEOUT)
}

fn run<T: DeserializeOwned>(step: &'static str, script: &str, limit: Duration) -> Reading<T> {
    let failure = |message: String| ReadError {
        step,
        hresult: None,
        message,
    };
    let mut child = Command::new(get_powershell_path())
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|error| ReadError::io(step, error))?;
    let stdout = child.stdout.take().map(drain);
    let stderr = child.stderr.take().map(drain);
    let started = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if started.elapsed() >= limit => {
                let _ = child.kill();
                return Err(failure(format!("timed out after {limit:?}")));
            }
            Ok(None) => thread::sleep(POLL_INTERVAL),
            Err(error) => {
                let _ = child.kill();
                return Err(ReadError::io(step, error));
            }
        }
    };
    let stdout = joined(stdout);
    let stderr = joined(stderr);
    if !status.success() {
        return Err(failure(format!("{status}: {}", stderr.trim())));
    }
    serde_json::from_str(stdout.trim())
        .map_err(|error| failure(format!("{error}: {}", stdout.trim())))
}

fn drain(mut pipe: impl Read + Send + 'static) -> JoinHandle<String> {
    thread::spawn(move || {
        let mut text = String::new();
        let _ = pipe.read_to_string(&mut text);
        text
    })
}

fn joined(reader: Option<JoinHandle<String>>) -> String {
    reader
        .and_then(|handle| handle.join().ok())
        .unwrap_or_default()
}

#[cfg(test)]
#[path = "cim_tests.rs"]
mod tests;
