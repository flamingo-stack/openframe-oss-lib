use crate::platform::directories::get_secured_directory;
use crate::utils::fs::atomic_write;
use std::fs;

pub const UPDATER_TOOL_AGENT_ID: &str = "openframe-client-updater";

const UPDATER_STATE_FILE_NAME: &str = "updater_state.json";
const UPDATER_STATE_STALE_SECS: u64 = 30 * 60;
const DRAINING_PHASE: &str = "draining";
const IN_FLIGHT_UPDATER_PHASES: [&str; 5] = [
    DRAINING_PHASE,
    "stopping_service",
    "replacing_binary",
    "starting_service",
    "verifying_boot",
];
const CLIENT_DRAINED_FILE_NAME: &str = "client_drained";

struct UpdaterState {
    phase: String,
    started_at: String,
}

/// The updater persists its CLIENT_UPDATE state machine to {secured}/updater_state.json.
/// From `draining` until the new binary has proved its boot, a tool operation started now
/// could be cut short by the service stop; a failed swap keeps its phase while the previous
/// binary is put back. State files untouched for over 30 minutes are ignored so a wedged
/// updater that stopped clearing its state can still be repaired remotely.
pub fn in_flight_client_update_phase() -> Option<String> {
    let state = read_updater_state()?;
    IN_FLIGHT_UPDATER_PHASES
        .contains(&state.phase.as_str())
        .then_some(state.phase)
}

/// The `started_at` of the update waiting for this client to drain, while the updater
/// shows `draining`.
pub fn updater_drain_request() -> Option<String> {
    let state = read_updater_state()?;
    (state.phase == DRAINING_PHASE).then_some(state.started_at)
}

/// Tells the updater that the update started at `token` may stop this client now.
pub fn write_drained_marker(token: &str) -> anyhow::Result<()> {
    atomic_write(
        &get_secured_directory().join(CLIENT_DRAINED_FILE_NAME),
        token,
    )
}

fn read_updater_state() -> Option<UpdaterState> {
    let path = get_secured_directory().join(UPDATER_STATE_FILE_NAME);
    let modified = fs::metadata(&path).ok()?.modified().ok()?;
    if let Ok(age) = modified.elapsed() {
        if age.as_secs() > UPDATER_STATE_STALE_SECS {
            return None;
        }
    }
    let raw = fs::read_to_string(&path).ok()?;
    let state: serde_json::Value = serde_json::from_str(&raw).ok()?;
    Some(UpdaterState {
        phase: state.get("phase")?.as_str()?.to_string(),
        started_at: state.get("started_at")?.as_str()?.to_string(),
    })
}
