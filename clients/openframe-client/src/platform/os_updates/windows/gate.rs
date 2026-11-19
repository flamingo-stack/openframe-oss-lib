use std::collections::BTreeSet;

use super::model::{
    Manageability, NotManageableReason, Reading, RegValue, SystemFacts, WindowsInventory,
};

const GENERAL_EDITIONS: [&str; 12] = [
    "Professional",
    "ProfessionalN",
    "ProfessionalWorkstation",
    "ProfessionalWorkstationN",
    "ProfessionalEducation",
    "ProfessionalEducationN",
    "Enterprise",
    "EnterpriseN",
    "Education",
    "EducationN",
    "IoTEnterprise",
    MULTI_SESSION_EDITION,
];
const MULTI_SESSION_EDITION: &str = "ServerRdsh";
const LTSC_EDITIONS: [&str; 3] = ["EnterpriseS", "EnterpriseSN", "IoTEnterpriseS"];
const AZURE_SERVER_EDITIONS: [&str; 2] = ["ServerAzureEdition", "ServerTurbine"];
const WINDOWS_10_22H2_BUILD: u32 = 19045;
const WINDOWS_11_FIRST_BUILD: u32 = 22000;
const LTSC_BUILDS: [u32; 2] = [17763, 19044];
const SERVER_BUILDS: [u32; 3] = [14393, 17763, 20348];
const WINDOWS_24H2_BUILD: u32 = 26100;
const ENGINE_SERVICES: [&str; 2] = ["wuauserv", "TrustedInstaller"];
const DISABLED_START: u32 = 4;
const PRE_BOOT_INPUT_PROTECTORS: [u32; 4] = [2, 4, 5, 6];

#[derive(Clone, Copy)]
enum Channel {
    General,
    Ltsc,
    Server,
}

pub fn manageability(inventory: &WindowsInventory) -> Manageability {
    use NotManageableReason::*;

    let mut reasons = BTreeSet::new();
    let management = &inventory.management;

    if let Some(system) = known(&inventory.system, &mut reasons) {
        match channel(system) {
            None => {
                reasons.insert(UnsupportedEdition);
            }
            Some(channel) => match system.current_build.parse::<u32>() {
                Err(_) => {
                    reasons.insert(Unreadable);
                }
                Ok(build) if !build_supported(channel, build) => {
                    reasons.insert(UnsupportedVersion);
                }
                Ok(_) => {}
            },
        }
    }

    if let Some(Some(filter)) = known(&inventory.write_filter, &mut reasons) {
        if filter.current_enabled || filter.next_enabled {
            reasons.insert(WriteFilter);
        }
    }

    let wu_policy = known(&management.wu_policy, &mut reasons).and_then(Option::as_ref);
    let wu_au_policy = known(&management.wu_au_policy, &mut reasons).and_then(Option::as_ref);
    if matches!(
        wu_au_policy.and_then(|values| values.get("UseWUServer")),
        Some(RegValue::Number(1))
    ) {
        reasons.insert(Wsus);
    }
    if let Some(services) = known(&management.update_services, &mut reasons) {
        if services.iter().any(|service| service.is_managed) {
            reasons.insert(Wsus);
        }
    }
    if [wu_policy, wu_au_policy]
        .into_iter()
        .flatten()
        .flatten()
        .any(|(name, value)| !(name == "AUOptions" && matches!(value, RegValue::Number(0))))
    {
        reasons.insert(GroupPolicy);
    }

    if let Some(Some(values)) = known(&management.mdm_update_policies, &mut reasons) {
        if !values.is_empty() {
            reasons.insert(Mdm);
        }
    }
    if let Some(enrollments) = known(&management.mdm_enrollments, &mut reasons) {
        if !enrollments.is_empty() {
            reasons.insert(Mdm);
        }
    }

    if known(&management.config_mgr_client, &mut reasons) == Some(&true) {
        reasons.insert(ConfigMgr);
    }

    if let Some(starts) = known(&management.service_start_types, &mut reasons) {
        let disabled = ENGINE_SERVICES.iter().any(
            |name| !matches!(starts.get(*name), Some(Some(start)) if *start != DISABLED_START),
        );
        if disabled {
            reasons.insert(UpdateServiceDisabled);
        }
    }

    if let Some(Some(bitlocker)) = known(&inventory.bitlocker, &mut reasons) {
        if bitlocker
            .protector_types
            .iter()
            .any(|kind| PRE_BOOT_INPUT_PROTECTORS.contains(kind))
        {
            reasons.insert(BitLockerPreBootInput);
        }
    }

    if reasons.is_empty() {
        Manageability::Manageable
    } else {
        Manageability::NotManageable {
            reasons: reasons.into_iter().collect(),
        }
    }
}

fn known<'a, T>(
    reading: &'a Reading<T>,
    reasons: &mut BTreeSet<NotManageableReason>,
) -> Option<&'a T> {
    if reading.is_err() {
        reasons.insert(NotManageableReason::Unreadable);
    }
    reading.as_ref().ok()
}

fn channel(system: &SystemFacts) -> Option<Channel> {
    let edition = system.edition_id.as_str();
    match system.product_type.as_str() {
        "WinNT" if GENERAL_EDITIONS.contains(&edition) => Some(Channel::General),
        "WinNT" if LTSC_EDITIONS.contains(&edition) => Some(Channel::Ltsc),
        "ServerNT" if edition == MULTI_SESSION_EDITION => Some(Channel::General),
        "ServerNT" | "LanmanNT"
            if edition.starts_with("Server") && !AZURE_SERVER_EDITIONS.contains(&edition) =>
        {
            Some(Channel::Server)
        }
        _ => None,
    }
}

fn build_supported(channel: Channel, build: u32) -> bool {
    match channel {
        Channel::General => build == WINDOWS_10_22H2_BUILD || build >= WINDOWS_11_FIRST_BUILD,
        Channel::Ltsc => LTSC_BUILDS.contains(&build) || build >= WINDOWS_24H2_BUILD,
        Channel::Server => SERVER_BUILDS.contains(&build) || build >= WINDOWS_24H2_BUILD,
    }
}
