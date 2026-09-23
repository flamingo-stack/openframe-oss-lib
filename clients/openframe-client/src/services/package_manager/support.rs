use super::ManagerId;
use std::sync::OnceLock;
use tracing::info;

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
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Support {
    Supported,
    Unsupported(&'static str),
}

const STORELESS_EDITIONS: &[&str] = &[
    "EnterpriseS",
    "EnterpriseSN",
    "IoTEnterprise",
    "IoTEnterpriseS",
];

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
    if spec.product_type == ProductType::Server {
        return Support::Unsupported("winget needs the Microsoft Store, absent on Windows Server");
    }
    match spec.edition_id.as_deref() {
        Some(edition)
            if STORELESS_EDITIONS
                .iter()
                .any(|known| edition.eq_ignore_ascii_case(known)) =>
        {
            Support::Unsupported("winget needs the Microsoft Store, absent on this Windows edition")
        }
        _ => Support::Supported,
    }
}

pub fn current() -> &'static OsSpec {
    static SPEC: OnceLock<OsSpec> = OnceLock::new();
    SPEC.get_or_init(|| {
        let spec = detect();
        info!(
            arch = ?spec.arch,
            product_type = ?spec.product_type,
            edition_id = ?spec.edition_id,
            "Detected machine spec for package manager support"
        );
        spec
    })
}

#[cfg(target_os = "macos")]
fn detect() -> OsSpec {
    OsSpec {
        arch: macos_arch(),
        product_type: ProductType::Unknown,
        edition_id: None,
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

    let edition_id = hklm
        .open_subkey(r"SOFTWARE\Microsoft\Windows NT\CurrentVersion")
        .and_then(|key| key.get_value::<String, _>("EditionID"))
        .ok();

    OsSpec {
        arch,
        product_type,
        edition_id,
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn detect() -> OsSpec {
    OsSpec {
        arch: Arch::Unknown,
        product_type: ProductType::Unknown,
        edition_id: None,
    }
}

#[cfg(test)]
#[path = "support_tests.rs"]
mod tests;
