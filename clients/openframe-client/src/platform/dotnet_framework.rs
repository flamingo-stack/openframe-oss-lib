pub(crate) const DOTNET_4_8_RELEASE: u32 = 528040;

#[cfg(target_os = "windows")]
pub(crate) fn dotnet_release() -> Option<u32> {
    use winreg::enums::HKEY_LOCAL_MACHINE;
    use winreg::RegKey;

    RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey(r"SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full")
        .and_then(|key| key.get_value::<u32, _>("Release"))
        .ok()
}
