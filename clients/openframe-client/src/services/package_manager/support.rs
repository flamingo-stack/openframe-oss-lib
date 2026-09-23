use super::ManagerId;
use std::sync::{Once, OnceLock};
use tracing::{info, warn};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Arch {
    Arm64,
    X86_64,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[allow(dead_code)]
enum ProductType {
    Workstation,
    Server,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct OsSpec {
    arch: Arch,
    product_type: ProductType,
    edition_id: Option<String>,
    build: Option<u32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Support {
    Supported,
    Unsupported(&'static str),
}

const MIN_WINGET_BUILD: u32 = 17763;
const MIN_SERVER_WINGET_BUILD: u32 = 26100;

const STORELESS_EDITIONS: &[&str] = &[
    "EnterpriseS",
    "EnterpriseSN",
    "IoTEnterprise",
    "IoTEnterpriseS",
];

const MULTI_SESSION_EDITIONS: &[&str] = &["ServerRdsh"];

pub fn is_supported(id: ManagerId) -> bool {
    support_of(id, current()) == Support::Supported
}

fn support_of(id: ManagerId, spec: &OsSpec) -> Support {
    match id {
        ManagerId::Brew => brew(spec),
        ManagerId::Winget => winget(spec),
        ManagerId::Choco => Support::Supported,
    }
}

fn brew(spec: &OsSpec) -> Support {
    match spec.arch {
        Arch::X86_64 => Support::Unsupported("Homebrew is Apple Silicon only"),
        Arch::Arm64 | Arch::Unknown => Support::Supported,
    }
}

fn winget(spec: &OsSpec) -> Support {
    let edition = spec.edition_id.as_deref();

    if spec.build.is_some_and(|build| build < MIN_WINGET_BUILD) {
        return Support::Unsupported("winget needs Windows 10 1809 or later");
    }

    if edition_in(edition, STORELESS_EDITIONS) {
        return Support::Unsupported(
            "winget needs the Microsoft Store, absent on this Windows edition",
        );
    }

    if spec.product_type == ProductType::Server
        && !edition_in(edition, MULTI_SESSION_EDITIONS)
        && spec
            .build
            .is_some_and(|build| build < MIN_SERVER_WINGET_BUILD)
    {
        return Support::Unsupported("winget needs Windows Server 2025 or later");
    }

    Support::Supported
}

fn edition_in(edition: Option<&str>, known: &[&str]) -> bool {
    edition.is_some_and(|actual| known.iter().any(|name| actual.eq_ignore_ascii_case(name)))
}

fn current() -> &'static OsSpec {
    static SPEC: OnceLock<OsSpec> = OnceLock::new();
    static LOGGED: Once = Once::new();

    let spec = SPEC.get_or_init(detect);
    LOGGED.call_once(|| log_spec_and_verdicts(spec));
    spec
}

fn log_spec_and_verdicts(spec: &OsSpec) {
    info!(
        arch = ?spec.arch,
        product_type = ?spec.product_type,
        edition_id = ?spec.edition_id,
        build = ?spec.build,
        "Detected machine spec for package manager support"
    );

    for id in ManagerId::for_current_platform() {
        if let Support::Unsupported(reason) = support_of(*id, spec) {
            warn!(
                manager = ?id,
                reason,
                product_type = ?spec.product_type,
                edition_id = ?spec.edition_id,
                build = ?spec.build,
                "Package manager gated as unsupported on this machine"
            );
        }
    }
}

#[cfg(target_os = "macos")]
fn detect() -> OsSpec {
    OsSpec {
        arch: macos_arch(),
        product_type: ProductType::Unknown,
        edition_id: None,
        build: None,
    }
}

#[cfg(target_os = "macos")]
fn macos_arch() -> Arch {
    let mut value: i32 = 0;
    let mut size = std::mem::size_of::<i32>();
    let rc = unsafe {
        libc::sysctlbyname(
            c"hw.optional.arm64".as_ptr(),
            &mut value as *mut i32 as *mut libc::c_void,
            &mut size,
            std::ptr::null_mut(),
            0,
        )
    };

    if rc == 0 {
        return if value == 1 {
            Arch::Arm64
        } else {
            Arch::X86_64
        };
    }

    match std::io::Error::last_os_error().raw_os_error() {
        Some(libc::ENOENT) => Arch::X86_64,
        _ => Arch::Unknown,
    }
}

#[cfg(target_os = "windows")]
fn detect() -> OsSpec {
    use winreg::enums::HKEY_LOCAL_MACHINE;
    use winreg::RegKey;

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);

    let arch = hklm
        .open_subkey(r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment")
        .and_then(|key| key.get_value::<String, _>("PROCESSOR_ARCHITECTURE"))
        .map(|value| match value.to_ascii_uppercase().as_str() {
            "ARM64" => Arch::Arm64,
            "AMD64" => Arch::X86_64,
            _ => Arch::Unknown,
        })
        .unwrap_or(Arch::Unknown);

    let product_type = hklm
        .open_subkey(r"SYSTEM\CurrentControlSet\Control\ProductOptions")
        .and_then(|key| key.get_value::<String, _>("ProductType"))
        .map(|value| match value.as_str() {
            "WinNT" => ProductType::Workstation,
            "ServerNT" | "LanmanNT" => ProductType::Server,
            _ => ProductType::Unknown,
        })
        .unwrap_or(ProductType::Unknown);

    let current_version = hklm.open_subkey(r"SOFTWARE\Microsoft\Windows NT\CurrentVersion");

    let edition_id = current_version
        .as_ref()
        .ok()
        .and_then(|key| key.get_value::<String, _>("EditionID").ok());

    let build = current_version
        .as_ref()
        .ok()
        .and_then(|key| key.get_value::<String, _>("CurrentBuildNumber").ok())
        .and_then(|value| value.trim().parse().ok());

    OsSpec {
        arch,
        product_type,
        edition_id,
        build,
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn detect() -> OsSpec {
    OsSpec {
        arch: Arch::Unknown,
        product_type: ProductType::Unknown,
        edition_id: None,
        build: None,
    }
}

#[cfg(test)]
#[path = "support_tests.rs"]
mod tests;
