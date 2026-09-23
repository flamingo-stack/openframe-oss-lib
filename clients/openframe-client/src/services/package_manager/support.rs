use super::ManagerId;
use std::sync::OnceLock;
use tracing::{info, warn};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Arch {
    Arm64,
    X86_64,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[allow(dead_code)]
pub enum ProductType {
    Workstation,
    Server,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OsSpec {
    pub arch: Arch,
    pub product_type: ProductType,
    pub edition_id: Option<String>,
    pub build: Option<u32>,
    pub store_provisioned: Option<bool>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Support {
    Supported,
    Unsupported(&'static str),
}

const MIN_WINGET_BUILD: u32 = 17763;
const SERVER_WITH_WINGET_BUILD: u32 = 26100;

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

pub fn support_of(id: ManagerId, spec: &OsSpec) -> Support {
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
    if spec.build.is_some_and(|build| build < MIN_WINGET_BUILD) {
        return Support::Unsupported("winget needs Windows 10 1809 or later");
    }

    if has_edition(spec, STORELESS_EDITIONS) {
        return Support::Unsupported(
            "winget needs the Microsoft Store, absent on this Windows edition",
        );
    }

    if has_edition(spec, MULTI_SESSION_EDITIONS) {
        return Support::Supported;
    }

    if spec.product_type == ProductType::Server {
        return match spec.build {
            Some(build) if build >= SERVER_WITH_WINGET_BUILD => Support::Supported,
            _ => Support::Unsupported("winget needs Windows Server 2025 or later"),
        };
    }

    Support::Supported
}

fn has_edition(spec: &OsSpec, editions: &[&str]) -> bool {
    spec.edition_id.as_deref().is_some_and(|actual| {
        editions
            .iter()
            .any(|known| actual.eq_ignore_ascii_case(known))
    })
}

pub fn current() -> &'static OsSpec {
    static SPEC: OnceLock<OsSpec> = OnceLock::new();
    SPEC.get_or_init(|| {
        let spec = detect();
        log_verdicts(&spec);
        spec
    })
}

fn log_verdicts(spec: &OsSpec) {
    info!(
        arch = ?spec.arch,
        product_type = ?spec.product_type,
        edition_id = ?spec.edition_id,
        build = ?spec.build,
        store_provisioned = ?spec.store_provisioned,
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
                store_provisioned = ?spec.store_provisioned,
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
        store_provisioned: None,
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
        store_provisioned: store_provisioned(&hklm),
    }
}

#[cfg(target_os = "windows")]
fn store_provisioned(hklm: &winreg::RegKey) -> Option<bool> {
    const APPX_STORE: &str = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Appx\AppxAllUserStore";
    const STORE_PREFIX: &str = "Microsoft.WindowsStore";

    let root = hklm.open_subkey(APPX_STORE).ok()?;

    let provisioned = ["Applications", "InboxApplications"].iter().any(|subkey| {
        root.open_subkey(subkey)
            .map(|key| {
                key.enum_keys()
                    .flatten()
                    .any(|name| name.starts_with(STORE_PREFIX))
            })
            .unwrap_or(false)
    });

    Some(provisioned)
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn detect() -> OsSpec {
    OsSpec {
        arch: Arch::Unknown,
        product_type: ProductType::Unknown,
        edition_id: None,
        build: None,
        store_provisioned: None,
    }
}

#[cfg(test)]
#[path = "support_tests.rs"]
mod tests;
