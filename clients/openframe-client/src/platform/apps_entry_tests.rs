use super::*;

const INSTALL_PATH: &str = r"C:\Program Files\OpenFrame\bin\openframe-client.exe";
const POWERSHELL: &str = r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe";

fn value<'a>(values: &'a [(&'static str, EntryValue)], name: &str) -> &'a EntryValue {
    &values
        .iter()
        .find(|(key, _)| *key == name)
        .unwrap_or_else(|| panic!("missing {name}"))
        .1
}

fn values() -> Vec<(&'static str, EntryValue)> {
    entry_values(Path::new(INSTALL_PATH), "1.5.33", Path::new(POWERSHELL))
}

#[test]
fn quiet_uninstall_runs_the_installed_binary() {
    assert_eq!(
        value(&values(), "QuietUninstallString"),
        &EntryValue::Text(
            r#""C:\Program Files\OpenFrame\bin\openframe-client.exe" uninstall"#.to_string()
        )
    );
}

#[test]
fn settings_uninstall_elevates_the_installed_binary() {
    assert_eq!(
        value(&values(), "UninstallString"),
        &EntryValue::Text(
            r#""C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath 'C:\Program Files\OpenFrame\bin\openframe-client.exe' -ArgumentList 'uninstall' -Verb RunAs -Wait""#
                .to_string()
        )
    );
}

#[test]
fn single_quotes_in_the_install_path_are_escaped() {
    let command = elevated_uninstall_command(
        Path::new(r"C:\O'Frame\openframe-client.exe"),
        Path::new(POWERSHELL),
    );
    assert!(command.contains(r"-FilePath 'C:\O''Frame\openframe-client.exe'"));
}

#[test]
fn version_and_location_come_from_the_install() {
    let values = values();
    assert_eq!(
        value(&values, "DisplayVersion"),
        &EntryValue::Text("1.5.33".to_string())
    );
    assert_eq!(
        value(&values, "InstallLocation"),
        &EntryValue::Text(r"C:\Program Files\OpenFrame\bin".to_string())
    );
    assert_eq!(
        value(&values, "DisplayIcon"),
        &EntryValue::Text(INSTALL_PATH.to_string())
    );
}

#[test]
fn modify_and_repair_are_hidden() {
    let values = values();
    assert_eq!(value(&values, "NoModify"), &EntryValue::Flag(1));
    assert_eq!(value(&values, "NoRepair"), &EntryValue::Flag(1));
}

#[test]
fn a_binary_outside_the_install_location_is_not_the_installed_one() {
    assert!(!is_installed_binary(Path::new(INSTALL_PATH)));
}

#[test]
fn register_and_double_unregister_under_hkcu() {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let key_path = format!(
        "Software\\OpenFrameTest-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    );

    register_at(&hkcu, &key_path, Path::new(INSTALL_PATH), "1.5.33").unwrap();
    let key = hkcu.open_subkey(&key_path).unwrap();
    let version: String = key.get_value("DisplayVersion").unwrap();
    let no_repair: u32 = key.get_value("NoRepair").unwrap();
    assert_eq!(version, "1.5.33");
    assert_eq!(no_repair, 1);
    drop(key);

    unregister_at(&hkcu, &key_path).unwrap();
    unregister_at(&hkcu, &key_path).unwrap();
    assert_eq!(
        hkcu.open_subkey(&key_path).unwrap_err().kind(),
        ErrorKind::NotFound
    );
}
