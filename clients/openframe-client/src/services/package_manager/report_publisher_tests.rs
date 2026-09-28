use super::*;

#[test]
fn report_serialises_to_the_agreed_wire_shape() {
    let mut package_managers = BTreeMap::new();
    for (id, state) in [
        (ManagerId::Brew, ManagerState::Present),
        (ManagerId::Choco, ManagerState::Unsupported),
        (ManagerId::Winget, ManagerState::Missing),
    ] {
        package_managers.insert(id, ManagerStatus { state });
    }

    let json = serde_json::to_string(&PackageManagerReport { package_managers }).unwrap();

    assert_eq!(
        json,
        r#"{"packageManagers":{"BREW":{"state":"PRESENT"},"CHOCO":{"state":"UNSUPPORTED"},"WINGET":{"state":"MISSING"}}}"#
    );
}

#[test]
fn the_subject_suffix_is_stable() {
    assert_eq!(PACKAGE_MANAGERS_SUBJECT, "package-managers");
}
