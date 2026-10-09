use super::*;

fn value<'a>(values: &'a [(&'static str, EntryValue)], name: &str) -> &'a EntryValue {
    &values
        .iter()
        .find(|(key, _)| *key == name)
        .unwrap_or_else(|| panic!("missing {name}"))
        .1
}

#[test]
fn uninstall_commands_quote_the_installed_binary() {
    let path = Path::new(r"C:\Program Files\OpenFrame\bin\openframe-client.exe");
    let values = entry_values(path, "1.5.33");

    let expected = EntryValue::Text(
        r#""C:\Program Files\OpenFrame\bin\openframe-client.exe" uninstall"#.to_string(),
    );
    assert_eq!(value(&values, "UninstallString"), &expected);
    assert_eq!(value(&values, "QuietUninstallString"), &expected);
}

#[test]
fn version_and_location_come_from_the_install() {
    let path = Path::new(r"C:\Program Files\OpenFrame\bin\openframe-client.exe");
    let values = entry_values(path, "1.5.33");

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
        &EntryValue::Text(path.display().to_string())
    );
}

#[test]
fn modify_and_repair_are_hidden() {
    let values = entry_values(Path::new(r"C:\x\openframe-client.exe"), "1.0.0");

    assert_eq!(value(&values, "NoModify"), &EntryValue::Flag(1));
    assert_eq!(value(&values, "NoRepair"), &EntryValue::Flag(1));
}
