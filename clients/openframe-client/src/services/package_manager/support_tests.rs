use super::*;

fn windows(edition: Option<&str>, product_type: ProductType, build: Option<u32>) -> OsSpec {
    OsSpec {
        os: Os::Windows,
        arch: Arch::X86_64,
        product_type,
        edition_id: edition.map(str::to_string),
        build,
    }
}

fn mac(arch: Arch) -> OsSpec {
    OsSpec {
        os: Os::Mac,
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
fn unknown_facts_fail_open_on_the_right_platform() {
    assert_eq!(
        support_of(ManagerId::Brew, &mac(Arch::Unknown)),
        Support::Supported
    );
    assert_eq!(
        support_of(
            ManagerId::Winget,
            &windows(None, ProductType::Unknown, None)
        ),
        Support::Supported
    );
}

#[test]
fn every_manager_is_gated_off_its_platform() {
    let desktop = windows(Some("Professional"), ProductType::Workstation, Some(19045));
    assert!(is_gated(ManagerId::Brew, &desktop));
    assert!(is_gated(ManagerId::Winget, &mac(Arch::Arm64)));
}

#[test]
fn choco_is_gated_everywhere_while_disabled() {
    assert!(is_gated(ManagerId::Choco, &mac(Arch::Arm64)));
    assert!(is_gated(
        ManagerId::Choco,
        &windows(Some("Professional"), ProductType::Workstation, Some(19045))
    ));
}

#[test]
fn each_manager_is_judged_independently() {
    let apple_silicon = mac(Arch::Arm64);
    assert_eq!(
        support_of(ManagerId::Brew, &apple_silicon),
        Support::Supported
    );
    assert!(is_gated(ManagerId::Winget, &apple_silicon));

    let desktop = windows(Some("Professional"), ProductType::Workstation, Some(19045));
    assert_eq!(support_of(ManagerId::Winget, &desktop), Support::Supported);
    assert!(is_gated(ManagerId::Brew, &desktop));
}
