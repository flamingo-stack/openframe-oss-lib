use super::*;
use crate::platform::os_updates::windows::fixtures::{
    manageable, unreadable, update_service, values,
};
use crate::platform::os_updates::windows::model::{
    Architecture, BitLockerFacts, MdmEnrollment, RegValues, WriteFilterFacts,
};
use NotManageableReason::*;

fn reasons_after(change: impl FnOnce(&mut WindowsInventory)) -> Vec<NotManageableReason> {
    let mut inventory = manageable();
    change(&mut inventory);
    match manageability(&inventory) {
        Manageability::Manageable => Vec::new(),
        Manageability::NotManageable { reasons } => {
            assert!(!reasons.is_empty(), "not manageable without a reason");
            reasons
        }
    }
}

fn on_system(
    product_type: &str,
    edition_id: &str,
    current_build: &str,
) -> Vec<NotManageableReason> {
    reasons_after(|inventory| {
        let system = inventory.system.as_mut().unwrap();
        system.product_type = product_type.into();
        system.edition_id = edition_id.into();
        system.current_build = current_build.into();
    })
}

fn bitlocker(protection_status: u32, protector_types: &[u32]) -> Option<BitLockerFacts> {
    Some(BitLockerFacts {
        mount_point: "C:".into(),
        protection_status,
        protector_types: protector_types.to_vec(),
    })
}

fn enrollment() -> MdmEnrollment {
    MdmEnrollment {
        provider_id: "MS DM Server".into(),
        enrollment_type: Some(6),
        enrollment_state: Some(1),
    }
}

#[test]
fn an_unmanaged_pro_workstation_is_manageable() {
    assert_eq!(manageability(&manageable()), Manageability::Manageable);
}

#[test]
fn committed_editions_and_builds_are_manageable() {
    let cases = [
        ("WinNT", "Professional", "19045", "Windows 10 22H2 Pro"),
        ("WinNT", "Enterprise", "19045", "Windows 10 22H2 Enterprise"),
        ("WinNT", "Education", "19045", "Windows 10 22H2 Education"),
        (
            "WinNT",
            "Professional",
            "22000",
            "Windows 11 21H2, the first build",
        ),
        ("WinNT", "ProfessionalN", "26100", "Windows 11 Pro N"),
        (
            "WinNT",
            "ProfessionalWorkstation",
            "26100",
            "Pro for Workstations",
        ),
        ("WinNT", "ProfessionalEducation", "26100", "Pro Education"),
        ("WinNT", "Professional", "30000", "a future Windows 11"),
        (
            "WinNT",
            "IoTEnterprise",
            "26100",
            "a kiosk on IoT Enterprise",
        ),
        ("WinNT", "EnterpriseS", "17763", "LTSC 2019"),
        ("WinNT", "EnterpriseS", "19044", "LTSC 2021"),
        ("WinNT", "EnterpriseS", "26100", "LTSC 2024"),
        (
            "WinNT",
            "IoTEnterpriseS",
            "19044",
            "IoT Enterprise LTSC 2021",
        ),
        ("ServerNT", "ServerStandard", "14393", "Server 2016"),
        ("ServerNT", "ServerDatacenter", "17763", "Server 2019"),
        ("ServerNT", "ServerStandard", "20348", "Server 2022"),
        ("ServerNT", "ServerDatacenter", "26100", "Server 2025"),
        ("ServerNT", "ServerSolution", "17763", "Server Essentials"),
        ("ServerNT", "ServerStandard", "30000", "a future Server"),
        ("LanmanNT", "ServerStandard", "20348", "a domain controller"),
        (
            "ServerNT",
            "ServerRdsh",
            "19045",
            "Windows 10 multi-session",
        ),
        (
            "ServerNT",
            "ServerRdsh",
            "22631",
            "Windows 11 multi-session",
        ),
        (
            "WinNT",
            "ServerRdsh",
            "22631",
            "multi-session reporting WinNT",
        ),
    ];
    for (product_type, edition, build, what) in cases {
        assert_eq!(on_system(product_type, edition, build), [], "{what}");
    }
}

#[test]
fn editions_outside_the_allow_list_are_not_manageable() {
    let cases = [
        ("WinNT", "Core", "26100", "Home"),
        ("WinNT", "CoreN", "26100", "Home N"),
        (
            "WinNT",
            "CoreSingleLanguage",
            "26100",
            "Home Single Language",
        ),
        ("WinNT", "CloudEdition", "26100", "SE"),
        (
            "WinNT",
            "SomethingNew",
            "26100",
            "an edition we do not know",
        ),
        ("WinNT", "", "26100", "an empty edition"),
        (
            "WinNT",
            "ServerStandard",
            "26100",
            "a server edition on a client",
        ),
        (
            "ServerNT",
            "Professional",
            "26100",
            "a client edition on a server",
        ),
        ("ServerNT", "ServerAzureEdition", "20348", "Azure Edition"),
        (
            "ServerNT",
            "ServerTurbine",
            "20348",
            "Azure Edition, the other name",
        ),
        (
            "Unknown",
            "Professional",
            "26100",
            "a product type we do not know",
        ),
    ];
    for (product_type, edition, build, what) in cases {
        assert_eq!(
            on_system(product_type, edition, build),
            [UnsupportedEdition],
            "{what}"
        );
    }
}

#[test]
fn builds_outside_the_allow_list_are_not_manageable() {
    let cases = [
        ("WinNT", "Professional", "19044", "Windows 10 21H2"),
        ("WinNT", "Professional", "17763", "Windows 10 1809"),
        ("WinNT", "Professional", "21999", "just below Windows 11"),
        (
            "WinNT",
            "Professional",
            "19046",
            "just above Windows 10 22H2",
        ),
        ("WinNT", "EnterpriseS", "14393", "LTSB 2016"),
        ("WinNT", "EnterpriseS", "19045", "no LTSC has this build"),
        (
            "ServerNT",
            "ServerStandard",
            "18363",
            "a Server semi-annual build",
        ),
        ("ServerNT", "ServerStandard", "9600", "Server 2012 R2"),
        (
            "ServerNT",
            "ServerStandard",
            "26099",
            "just below Server 2025",
        ),
        (
            "ServerNT",
            "ServerRdsh",
            "20348",
            "multi-session on a server build",
        ),
    ];
    for (product_type, edition, build, what) in cases {
        assert_eq!(
            on_system(product_type, edition, build),
            [UnsupportedVersion],
            "{what}"
        );
    }
}

#[test]
fn a_build_that_is_not_a_number_is_unreadable() {
    for build in ["", "26100.1", "Germanium"] {
        assert_eq!(
            on_system("WinNT", "Professional", build),
            [Unreadable],
            "{build:?}"
        );
    }
}

#[test]
fn a_write_filter_that_is_or_will_be_on_closes_the_gate() {
    for (current_enabled, next_enabled, expected) in [
        (true, true, vec![WriteFilter]),
        (true, false, vec![WriteFilter]),
        (false, true, vec![WriteFilter]),
        (false, false, vec![]),
    ] {
        let reasons = reasons_after(|inventory| {
            inventory.write_filter = Ok(Some(WriteFilterFacts {
                current_enabled,
                next_enabled,
            }))
        });
        assert_eq!(
            reasons, expected,
            "current={current_enabled} next={next_enabled}"
        );
    }
}

#[test]
fn any_update_policy_value_closes_the_gate_except_au_options_zero() {
    type Case = (&'static [(&'static str, u64)], Vec<NotManageableReason>);
    let cases: [Case; 8] = [
        (&[], vec![]),
        (&[("AUOptions", 0)], vec![]),
        (&[("AUOptions", 1)], vec![GroupPolicy]),
        (&[("AUOptions", 4)], vec![GroupPolicy]),
        (&[("NoAutoUpdate", 0)], vec![GroupPolicy]),
        (&[("NoAutoUpdate", 1)], vec![GroupPolicy]),
        (&[("AUOptions", 0), ("NoAutoUpdate", 1)], vec![GroupPolicy]),
        (&[("UseWUServer", 0)], vec![GroupPolicy]),
    ];
    for (entries, expected) in cases {
        let in_au = reasons_after(|inventory| inventory.management.wu_au_policy = values(entries));
        let in_wu = reasons_after(|inventory| inventory.management.wu_policy = values(entries));
        assert_eq!(in_au, expected, "AU {entries:?}");
        assert_eq!(in_wu, expected, "WindowsUpdate {entries:?}");
    }
}

#[test]
fn au_options_of_another_type_is_not_the_exception() {
    let reasons = reasons_after(|inventory| {
        inventory.management.wu_au_policy = Ok(Some(RegValues::from([(
            "AUOptions".to_string(),
            RegValue::Text("0".into()),
        )])));
    });
    assert_eq!(reasons, [GroupPolicy]);
}

#[test]
fn a_wsus_is_seen_by_policy_or_by_its_service() {
    let by_policy = reasons_after(|inventory| {
        inventory.management.wu_au_policy = values(&[("UseWUServer", 1)]);
    });
    let left_over = reasons_after(|inventory| {
        inventory.management.wu_policy = Ok(Some(RegValues::from([(
            "WUServer".to_string(),
            RegValue::Text("http://wsus".into()),
        )])));
    });
    let by_service = reasons_after(|inventory| {
        let mut service = update_service("3da21691-e39d-4da6-8a4b-b43877bcb1b7");
        service.is_managed = true;
        inventory.management.update_services = Ok(vec![service]);
    });
    assert_eq!(by_policy, [Wsus, GroupPolicy]);
    assert_eq!(left_over, [GroupPolicy]);
    assert_eq!(by_service, [Wsus]);
}

#[test]
fn mdm_closes_the_gate_by_enrollment_or_by_update_policy() {
    let by_enrollment = reasons_after(|inventory| {
        inventory.management.mdm_enrollments = Ok(vec![enrollment()]);
    });
    let by_policy = reasons_after(|inventory| {
        inventory.management.mdm_update_policies = values(&[("AllowAutoUpdate", 1)]);
    });
    let by_both = reasons_after(|inventory| {
        inventory.management.mdm_enrollments = Ok(vec![enrollment()]);
        inventory.management.mdm_update_policies = values(&[("AllowAutoUpdate", 1)]);
    });
    let empty_key = reasons_after(|inventory| {
        inventory.management.mdm_update_policies = values(&[]);
    });
    assert_eq!(by_enrollment, [Mdm]);
    assert_eq!(by_policy, [Mdm]);
    assert_eq!(by_both, [Mdm]);
    assert_eq!(empty_key, []);
}

fn enrolled(provider_id: &str, enrollment_type: Option<u32>) -> MdmEnrollment {
    MdmEnrollment {
        provider_id: provider_id.into(),
        enrollment_type,
        enrollment_state: Some(1),
    }
}

fn windows_11_built_in() -> Vec<MdmEnrollment> {
    vec![
        enrolled("Local Authority", Some(28)),
        enrolled("Cloud Authority", Some(31)),
        enrolled("Deploy Authority", Some(30)),
        enrolled("WMI_Bridge_SCCM_Server", Some(12)),
    ]
}

#[test]
fn the_enrollments_windows_11_creates_for_itself_are_not_mdm() {
    let reasons = reasons_after(|inventory| {
        inventory.management.mdm_enrollments = Ok(windows_11_built_in());
    });
    assert_eq!(reasons, []);
}

#[test]
fn a_real_enrollment_among_the_built_in_ones_is_mdm() {
    let reasons = reasons_after(|inventory| {
        let mut enrollments = windows_11_built_in();
        enrollments.push(enrollment());
        inventory.management.mdm_enrollments = Ok(enrollments);
    });
    assert_eq!(reasons, [Mdm]);
}

#[test]
fn a_built_in_enrollment_needs_both_its_name_and_its_type() {
    for (provider_id, enrollment_type) in [
        ("Local Authority", Some(6)),
        ("Local Authority", Some(31)),
        ("Local Authority", None),
        ("local authority", Some(28)),
        ("Some MDM", Some(28)),
        ("MS DM Server", Some(12)),
    ] {
        let reasons = reasons_after(|inventory| {
            inventory.management.mdm_enrollments = Ok(vec![enrolled(provider_id, enrollment_type)]);
        });
        assert_eq!(reasons, [Mdm], "{provider_id} {enrollment_type:?}");
    }
}

#[test]
fn update_policies_from_mdm_close_the_gate_beside_the_built_in_enrollments() {
    let reasons = reasons_after(|inventory| {
        inventory.management.mdm_enrollments = Ok(windows_11_built_in());
        inventory.management.mdm_update_policies = values(&[("AllowAutoUpdate", 1)]);
    });
    assert_eq!(reasons, [Mdm]);
}

#[test]
fn a_config_mgr_client_closes_the_gate() {
    let reasons = reasons_after(|inventory| inventory.management.config_mgr_client = Ok(true));
    assert_eq!(reasons, [ConfigMgr]);
}

#[test]
fn only_the_engine_services_decide_and_only_when_disabled_or_absent() {
    let cases = [
        ("wuauserv", Some(4), vec![UpdateServiceDisabled]),
        ("wuauserv", None, vec![UpdateServiceDisabled]),
        ("wuauserv", Some(2), vec![]),
        ("TrustedInstaller", Some(4), vec![UpdateServiceDisabled]),
        ("TrustedInstaller", None, vec![UpdateServiceDisabled]),
        ("UsoSvc", Some(4), vec![]),
        ("WaaSMedicSvc", None, vec![]),
        ("BITS", Some(4), vec![]),
    ];
    for (service, start, expected) in cases {
        let reasons = reasons_after(|inventory| {
            inventory
                .management
                .service_start_types
                .as_mut()
                .unwrap()
                .insert(service.into(), start);
        });
        assert_eq!(reasons, expected, "{service} {start:?}");
    }
}

#[test]
fn bitlocker_closes_the_gate_only_when_boot_needs_a_person() {
    let cases = [
        (None, vec![], "no BitLocker"),
        (bitlocker(0, &[]), vec![], "not encrypted"),
        (bitlocker(1, &[1, 3]), vec![], "TPM and recovery password"),
        (
            bitlocker(1, &[4, 3]),
            vec![BitLockerPreBootInput],
            "TPM and PIN",
        ),
        (
            bitlocker(1, &[5]),
            vec![BitLockerPreBootInput],
            "TPM and startup key",
        ),
        (
            bitlocker(1, &[6]),
            vec![BitLockerPreBootInput],
            "TPM, PIN and startup key",
        ),
        (
            bitlocker(1, &[2]),
            vec![BitLockerPreBootInput],
            "external key",
        ),
        (
            bitlocker(0, &[4]),
            vec![BitLockerPreBootInput],
            "PIN, protection suspended",
        ),
    ];
    for (facts, expected, what) in cases {
        let reasons = reasons_after(|inventory| inventory.bitlocker = Ok(facts));
        assert_eq!(reasons, expected, "{what}");
    }
}

#[test]
fn every_input_of_the_gate_closes_it_when_unreadable() {
    type Break = fn(&mut WindowsInventory);
    let cases: [(&str, Break); 10] = [
        ("system", |i| i.system = unreadable()),
        ("write filter", |i| i.write_filter = unreadable()),
        ("bitlocker", |i| i.bitlocker = unreadable()),
        ("wu policy", |i| i.management.wu_policy = unreadable()),
        ("au policy", |i| i.management.wu_au_policy = unreadable()),
        ("update services", |i| {
            i.management.update_services = unreadable()
        }),
        ("mdm policies", |i| {
            i.management.mdm_update_policies = unreadable()
        }),
        ("mdm enrollments", |i| {
            i.management.mdm_enrollments = unreadable()
        }),
        ("config mgr", |i| {
            i.management.config_mgr_client = unreadable()
        }),
        ("service starts", |i| {
            i.management.service_start_types = unreadable()
        }),
    ];
    for (input, break_it) in cases {
        assert_eq!(reasons_after(break_it), [Unreadable], "{input}");
    }
}

#[test]
fn readings_the_gate_does_not_use_never_close_it() {
    type Break = fn(&mut WindowsInventory);
    let cases: [(&str, Break); 11] = [
        ("update search", |i| i.applicable = unreadable()),
        ("last scan", |i| i.last_scan = unreadable()),
        ("history", |i| i.history = unreadable()),
        ("defender", |i| i.defender = unreadable()),
        ("reboot signal", |i| {
            i.reboot.wua_reboot_required = unreadable()
        }),
        ("pending reboot", |i| {
            i.reboot_pending = super::super::model::RebootPending::Yes
        }),
        ("ux settings", |i| {
            i.management.wu_ux_settings = unreadable()
        }),
        ("domain", |i| i.management.domain_joined = Ok(true)),
        ("entra", |i| i.management.entra_joined = Ok(true)),
        ("cluster", |i| {
            i.system.as_mut().unwrap().cluster_node = true
        }),
        ("arm64", |i| {
            i.system.as_mut().unwrap().native_architecture = Some(Architecture::Arm64)
        }),
    ];
    for (reading, change) in cases {
        assert_eq!(reasons_after(change), [], "{reading}");
    }
}

#[test]
fn all_reasons_are_reported_once_and_always_in_the_same_order() {
    let reasons = reasons_after(|inventory| {
        inventory.system.as_mut().unwrap().edition_id = "Core".into();
        inventory.bitlocker = Ok(bitlocker(1, &[4, 5, 6]));
        inventory.management.config_mgr_client = Ok(true);
        inventory.management.service_start_types = unreadable();
        inventory.management.mdm_enrollments = Ok(vec![enrollment(), enrollment()]);
        inventory.management.update_services = unreadable();
        inventory.management.wu_policy = values(&[("DeferQualityUpdates", 1)]);
        inventory.management.wu_au_policy = values(&[("UseWUServer", 1), ("NoAutoUpdate", 1)]);
    });
    assert_eq!(
        reasons,
        [
            Unreadable,
            UnsupportedEdition,
            Wsus,
            GroupPolicy,
            Mdm,
            ConfigMgr,
            BitLockerPreBootInput
        ]
    );
}

#[test]
fn the_wire_names_are_the_ones_the_backend_stores() {
    let all = Manageability::NotManageable {
        reasons: vec![
            Unreadable,
            UnsupportedEdition,
            UnsupportedVersion,
            WriteFilter,
            Wsus,
            GroupPolicy,
            Mdm,
            ConfigMgr,
            UpdateServiceDisabled,
            BitLockerPreBootInput,
        ],
    };
    assert_eq!(
        serde_json::to_value(&all).unwrap(),
        serde_json::json!({
            "state": "NOT_MANAGEABLE",
            "reasons": [
                "UNREADABLE",
                "UNSUPPORTED_EDITION",
                "UNSUPPORTED_VERSION",
                "WRITE_FILTER",
                "WSUS",
                "GROUP_POLICY",
                "MDM",
                "CONFIG_MGR",
                "UPDATE_SERVICE_DISABLED",
                "BITLOCKER_PRE_BOOT_INPUT"
            ]
        })
    );
    assert_eq!(
        serde_json::to_value(Manageability::Manageable).unwrap(),
        serde_json::json!({ "state": "MANAGEABLE" })
    );
}
