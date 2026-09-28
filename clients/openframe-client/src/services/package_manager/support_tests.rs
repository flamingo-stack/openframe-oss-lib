use super::*;

fn windows(edition: Option<&str>, product_type: ProductType, build: Option<u32>) -> OsSpec {
    OsSpec {
        arch: Arch::X86_64,
        product_type,
        edition_id: edition.map(str::to_string),
        build,
    }
}

fn mac(arch: Arch) -> OsSpec {
    OsSpec {
        arch,
        product_type: ProductType::Unknown,
        edition_id: None,
        build: None,
    }
}

fn is_gated(id: ManagerId, spec: &OsSpec) -> bool {
    matches!(support_of(id, spec), Support::Unsupported(_))
}

#[test]
fn brew_is_unsupported_on_intel() {
    assert!(is_gated(ManagerId::Brew, &mac(Arch::X86_64)));
}

#[test]
fn brew_is_supported_on_apple_silicon() {
    assert_eq!(
        support_of(ManagerId::Brew, &mac(Arch::Arm64)),
        Support::Supported
    );
}

#[test]
fn winget_is_supported_on_a_desktop_edition() {
    let spec = windows(Some("Professional"), ProductType::Workstation, Some(19045));
    assert_eq!(support_of(ManagerId::Winget, &spec), Support::Supported);
}

#[test]
fn winget_is_gated_on_storeless_editions() {
    for edition in [
        "EnterpriseS",
        "enterprisesn",
        "IoTEnterprise",
        "IOTENTERPRISES",
    ] {
        let spec = windows(Some(edition), ProductType::Workstation, Some(17763));
        assert!(
            is_gated(ManagerId::Winget, &spec),
            "expected {edition} to be gated"
        );
    }
}

#[test]
fn winget_is_gated_below_the_minimum_build() {
    let spec = windows(Some("Professional"), ProductType::Workstation, Some(17134));
    assert!(is_gated(ManagerId::Winget, &spec));
}

#[test]
fn winget_is_gated_on_server_before_2025() {
    let spec = windows(Some("ServerStandard"), ProductType::Server, Some(20348));
    assert!(is_gated(ManagerId::Winget, &spec));
}

#[test]
fn winget_is_supported_on_server_2025() {
    let spec = windows(Some("ServerStandard"), ProductType::Server, Some(26100));
    assert_eq!(support_of(ManagerId::Winget, &spec), Support::Supported);
}

#[test]
fn an_unreadable_build_never_gates() {
    let server = windows(Some("ServerStandard"), ProductType::Server, None);
    assert_eq!(support_of(ManagerId::Winget, &server), Support::Supported);

    let desktop = windows(Some("Professional"), ProductType::Workstation, None);
    assert_eq!(support_of(ManagerId::Winget, &desktop), Support::Supported);
}

#[test]
fn winget_is_supported_on_multi_session_despite_the_server_product_type() {
    let spec = windows(Some("ServerRdsh"), ProductType::Server, Some(19044));
    assert_eq!(support_of(ManagerId::Winget, &spec), Support::Supported);
}

#[test]
fn an_unreadable_edition_still_gates_an_old_server() {
    let spec = windows(None, ProductType::Server, Some(20348));
    assert!(is_gated(ManagerId::Winget, &spec));
}

#[test]
fn unknown_facts_fail_open() {
    let spec = OsSpec {
        arch: Arch::Unknown,
        product_type: ProductType::Unknown,
        edition_id: None,
        build: None,
    };
    assert_eq!(support_of(ManagerId::Brew, &spec), Support::Supported);
    assert_eq!(support_of(ManagerId::Winget, &spec), Support::Supported);
}

#[test]
fn gating_one_manager_leaves_the_others_alone() {
    let intel = mac(Arch::X86_64);
    assert!(is_gated(ManagerId::Brew, &intel));
    assert_eq!(support_of(ManagerId::Winget, &intel), Support::Supported);
    assert_eq!(support_of(ManagerId::Choco, &intel), Support::Supported);

    let server = windows(Some("ServerStandard"), ProductType::Server, Some(20348));
    assert!(is_gated(ManagerId::Winget, &server));
    assert_eq!(support_of(ManagerId::Choco, &server), Support::Supported);
}
