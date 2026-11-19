use super::machine;
use super::model::{ManagementSignals, RebootPending, RebootSignals, WindowsInventory};
use super::{cim, wua};

const WU_POLICY: &str = r"SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate";
const WU_AU_POLICY: &str = r"SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU";
const WU_UX_SETTINGS: &str = r"SOFTWARE\Microsoft\WindowsUpdate\UX\Settings";
const UPDATE_POLICY_SETTINGS: &str = r"SOFTWARE\Microsoft\WindowsUpdate\UpdatePolicy\Settings";
const MDM_UPDATE_POLICIES: &str = r"SOFTWARE\Microsoft\PolicyManager\current\device\Update";
const ENTRA_JOIN_INFO: &str = r"SYSTEM\CurrentControlSet\Control\CloudDomainJoin\JoinInfo";
const CONFIG_MGR_SERVICE: &str = r"SYSTEM\CurrentControlSet\Services\CcmExec";
const WRITE_FILTER_SERVICE: &str = r"SYSTEM\CurrentControlSet\Services\uwfvol";
const UPDATE_STACK_SERVICES: [&str; 5] = [
    "wuauserv",
    "UsoSvc",
    "WaaSMedicSvc",
    "BITS",
    "TrustedInstaller",
];
const WU_REBOOT_REQUIRED: &str =
    r"SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired";
const CBS_REBOOT_PENDING: &str =
    r"SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending";
const CBS_REBOOT_IN_PROGRESS: &str =
    r"SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootInProgress";

pub fn read_inventory() -> WindowsInventory {
    let read_at = chrono::Utc::now();
    let started = std::time::Instant::now();
    let wua = wua::read();
    let reboot = RebootSignals {
        wua_reboot_required: wua.reboot_required,
        wu_reboot_required_key: machine::key_exists(WU_REBOOT_REQUIRED),
        cbs_reboot_pending: machine::key_exists(CBS_REBOOT_PENDING),
        cbs_reboot_in_progress: machine::key_exists(CBS_REBOOT_IN_PROGRESS),
        pending_file_rename_entries: machine::pending_file_rename_entries(),
    };
    let reboot_pending = RebootPending::from_signals(&reboot, &wua.applicable);
    let management = ManagementSignals {
        wu_policy: machine::values(WU_POLICY),
        wu_au_policy: machine::values(WU_AU_POLICY),
        wu_ux_settings: machine::values(WU_UX_SETTINGS),
        update_policy_settings: machine::values(UPDATE_POLICY_SETTINGS),
        mdm_update_policies: machine::values(MDM_UPDATE_POLICIES),
        mdm_enrollments: machine::mdm_enrollments(),
        domain_joined: machine::domain_joined(),
        entra_joined: machine::has_subkeys(ENTRA_JOIN_INFO),
        config_mgr_client: machine::key_exists(CONFIG_MGR_SERVICE),
        service_start_types: machine::service_start_types(&UPDATE_STACK_SERVICES),
        update_services: wua.update_services,
    };
    let write_filter = machine::key_exists(WRITE_FILTER_SERVICE).and_then(|installed| {
        if installed {
            cim::write_filter().map(Some)
        } else {
            Ok(None)
        }
    });
    WindowsInventory {
        read_at,
        system: machine::system_facts(),
        applicable: wua.applicable,
        last_scan: wua.last_scan,
        history: wua.history,
        reboot,
        reboot_pending,
        management,
        defender: machine::defender(),
        bitlocker: cim::bitlocker(),
        write_filter,
        read_duration_ms: started.elapsed().as_millis() as u64,
    }
}
