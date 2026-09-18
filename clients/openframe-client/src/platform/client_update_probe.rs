use crate::platform::directories::get_secured_directory;

pub const UPDATER_TOOL_AGENT_ID: &str = "openframe-client-updater";

const UPDATER_STATE_FILE_NAME: &str = "updater_state.json";
const UPDATER_STATE_STALE_SECS: u64 = 30 * 60;
const IN_FLIGHT_UPDATER_PHASES: [&str; 8] = [
    "idle",
    "downloading",
    "verifying",
    "stopping_service",
    "replacing_binary",
    "starting_service",
    "verifying_boot",
    "rolling_back",
];

/// The updater persists its CLIENT_UPDATE state machine to {secured}/updater_state.json;
/// a phase there that precedes the swap (or is the swap) means a tool operation
/// dispatched now could be killed by the service stop. `observing` is excluded: the new
/// client is already up and healthy, only the anchor promotion is pending. State files
/// untouched for over 30 minutes are ignored so a wedged updater that stopped clearing
/// its state can still be repaired remotely.
pub fn in_flight_client_update_phase() -> Option<String> {
    let path = get_secured_directory().join(UPDATER_STATE_FILE_NAME);
    let modified = std::fs::metadata(&path).ok()?.modified().ok()?;
    if let Ok(age) = modified.elapsed() {
        if age.as_secs() > UPDATER_STATE_STALE_SECS {
            return None;
        }
    }
    let raw = std::fs::read_to_string(&path).ok()?;
    let state: serde_json::Value = serde_json::from_str(&raw).ok()?;
    let phase = state.get("phase")?.as_str()?;
    IN_FLIGHT_UPDATER_PHASES
        .contains(&phase)
        .then(|| phase.to_string())
}
