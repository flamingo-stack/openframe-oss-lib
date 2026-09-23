use super::*;

fn spec(arch: Arch, product_type: ProductType, edition_id: Option<&str>) -> OsSpec {
    OsSpec {
        arch,
        product_type,
        edition_id: edition_id.map(str::to_string),
    }
}

#[test]
fn brew_is_unsupported_on_intel() {
    let spec = spec(Arch::X86_64, ProductType::Unknown, None);
    assert!(matches!(
        support_of(ManagerId::Brew, &spec),
        Support::Unsupported(_)
    ));
}

#[test]
fn brew_is_supported_on_apple_silicon() {
    let spec = spec(Arch::Arm64, ProductType::Unknown, None);
    assert_eq!(support_of(ManagerId::Brew, &spec), Support::Supported);
}

#[test]
fn winget_is_gated_on_server_but_choco_is_not() {
    let spec = spec(Arch::X86_64, ProductType::Server, None);
    assert!(matches!(
        support_of(ManagerId::Winget, &spec),
        Support::Unsupported(_)
    ));
    assert_eq!(support_of(ManagerId::Choco, &spec), Support::Supported);
}

#[test]
fn winget_is_gated_on_storeless_editions() {
    for edition in ["EnterpriseS", "iotenterprise", "ENTERPRISESN"] {
        let spec = spec(Arch::X86_64, ProductType::Workstation, Some(edition));
        assert!(
            matches!(
                support_of(ManagerId::Winget, &spec),
                Support::Unsupported(_)
            ),
            "expected {edition} to be gated"
        );
    }
}

#[test]
fn winget_is_supported_on_a_workstation_edition() {
    let spec = spec(Arch::X86_64, ProductType::Workstation, Some("Professional"));
    assert_eq!(support_of(ManagerId::Winget, &spec), Support::Supported);
}

#[test]
fn intel_gates_brew_only_and_leaves_other_managers_alone() {
    let spec = spec(Arch::X86_64, ProductType::Workstation, None);
    assert!(matches!(
        support_of(ManagerId::Brew, &spec),
        Support::Unsupported(_)
    ));
    assert_eq!(support_of(ManagerId::Winget, &spec), Support::Supported);
    assert_eq!(support_of(ManagerId::Choco, &spec), Support::Supported);
}

#[test]
fn unknown_facts_fail_open() {
    let spec = spec(Arch::Unknown, ProductType::Unknown, None);
    assert_eq!(support_of(ManagerId::Brew, &spec), Support::Supported);
    assert_eq!(support_of(ManagerId::Winget, &spec), Support::Supported);
    assert_eq!(support_of(ManagerId::Choco, &spec), Support::Supported);
}
