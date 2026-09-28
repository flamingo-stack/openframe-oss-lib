use std::fs;
use std::path::Path;
use tracing::warn;

pub const TOOL_OPS_IN_FLIGHT_FILE_NAME: &str = "tool_ops_in_flight.json";

/// Mirrors the set of tools with an operation in flight (install, update,
/// uninstall, restart) to {secured}/tool_ops_in_flight.json for
/// openframe-client-updater, which must not stop this process mid-operation.
/// An empty set removes the file.
pub fn write_in_flight_tool_ops(secured_dir: &Path, tool_ids: &[String]) {
    let path = secured_dir.join(TOOL_OPS_IN_FLIGHT_FILE_NAME);

    if tool_ids.is_empty() {
        if path.exists() {
            if let Err(e) = fs::remove_file(&path) {
                warn!("Failed to remove tool-op marker {}: {}", path.display(), e);
            }
        }
        return;
    }

    let json = match serde_json::to_string(tool_ids) {
        Ok(json) => json,
        Err(e) => {
            warn!("Failed to serialize tool-op marker: {}", e);
            return;
        }
    };
    let temp_path = path.with_extension("json.tmp");
    if let Err(e) = fs::write(&temp_path, json).and_then(|_| fs::rename(&temp_path, &path)) {
        warn!("Failed to write tool-op marker {}: {}", path.display(), e);
        let _ = fs::remove_file(&temp_path);
    }
}

#[cfg(test)]
#[path = "tool_ops_marker_tests.rs"]
mod tests;
