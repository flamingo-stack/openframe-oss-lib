use super::*;

#[test]
fn report_serialises_to_the_agreed_wire_shape() {
    let package_managers = BTreeMap::from([
        (ManagerId::Brew, ManagerState::Present),
        (ManagerId::Choco, ManagerState::Unsupported),
        (ManagerId::Winget, ManagerState::Missing),
    ]);

    let json = serde_json::to_string(&PackageManagerReport {
        package_managers,
        dependencies: vec![DependencyReport {
            manager: ManagerId::Winget,
            name: Dependency::WingetClientModule,
            state: ManagerState::Missing,
        }],
    })
    .unwrap();

    assert_eq!(
        json,
        r#"{"packageManagers":{"BREW":"PRESENT","CHOCO":"UNSUPPORTED","WINGET":"MISSING"},"dependencies":[{"manager":"WINGET","name":"WINGET_CLIENT_MODULE","state":"MISSING"}]}"#
    );
}

#[test]
fn the_subject_suffix_is_stable() {
    assert_eq!(PACKAGE_MANAGERS_SUBJECT, "package-managers");
}
