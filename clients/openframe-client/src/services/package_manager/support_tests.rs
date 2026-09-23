use super::*;

fn windows(edition: Option<&str>, product_type: ProductType, build: Option<u32>) -> OsSpec {
    OsSpec {
        arch: Arch::X86_64,
        product_type,
        edition_id: edition.map(str::to_string),
        build,
        store_provisioned: None,
    }
}

fn mac(arch: Arch) -> OsSpec {
    OsSpec {
        arch,
        product_type: ProductType::Unknown,
        edition_id: None,
        build: None,
        store_provisioned: None,
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
fn winget_is_gated_on_a_server_with_an_unreadable_build() {
    let spec = windows(Some("ServerStandard"), ProductType::Server, None);
    assert!(is_gated(ManagerId::Winget, &spec));
}

#[test]
fn winget_is_supported_on_multi_session_despite_the_server_product_type() {
    let spec = windows(Some("ServerRdsh"), ProductType::Server, Some(26100));
    assert_eq!(support_of(ManagerId::Winget, &spec), Support::Supported);
}

#[test]
fn store_provisioning_never_changes_the_verdict() {
    let gated = windows(Some("EnterpriseS"), ProductType::Workstation, Some(17763));
    let mut with_store = gated.clone();
    with_store.store_provisioned = Some(true);

    assert_eq!(
        support_of(ManagerId::Winget, &gated),
        support_of(ManagerId::Winget, &with_store)
    );
}

#[test]
fn unknown_facts_fail_open() {
    let spec = OsSpec {
        arch: Arch::Unknown,
        product_type: ProductType::Unknown,
        edition_id: None,
        build: None,
        store_provisioned: None,
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
