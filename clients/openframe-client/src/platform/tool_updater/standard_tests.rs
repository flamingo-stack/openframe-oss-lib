use super::resolve_recorded_executable;
use std::path::PathBuf;

fn agent_path() -> PathBuf {
    PathBuf::from("/Library/Application Support/OpenFrame/fleetmdm-agent/agent")
}

#[test]
fn no_recorded_path_falls_back_to_the_default_agent_path() {
    assert_eq!(
        resolve_recorded_executable(agent_path(), None),
        agent_path()
    );
}

/// The case the fix exists for: a folder-extraction config installs to `<tool>/bin/orbit`,
/// so writing to `<tool>/agent` would leave the tool running its old binary while the
/// record — and the backend — reported the new version.
#[test]
fn relative_recorded_path_is_joined_onto_the_tool_directory() {
    assert_eq!(
        resolve_recorded_executable(agent_path(), Some("bin/orbit")),
        PathBuf::from("/Library/Application Support/OpenFrame/fleetmdm-agent/bin/orbit")
    );
}

#[test]
fn absolute_unix_recorded_path_is_taken_as_is() {
    assert_eq!(
        resolve_recorded_executable(agent_path(), Some("/opt/orbit/bin/orbit")),
        PathBuf::from("/opt/orbit/bin/orbit")
    );
}

/// Windows absolute paths are detected by the drive colon, not a leading slash.
#[test]
fn windows_absolute_recorded_path_is_taken_as_is() {
    assert_eq!(
        resolve_recorded_executable(
            PathBuf::from("C:\\ProgramData\\OpenFrame\\fleetmdm-agent\\agent.exe"),
            Some("C:\\Program Files\\Orbit\\orbit.exe")
        ),
        PathBuf::from("C:\\Program Files\\Orbit\\orbit.exe")
    );
}

/// A bare filename still lands beside the default agent binary rather than replacing it.
#[test]
fn bare_filename_resolves_next_to_the_agent_binary() {
    assert_eq!(
        resolve_recorded_executable(agent_path(), Some("orbit")),
        PathBuf::from("/Library/Application Support/OpenFrame/fleetmdm-agent/orbit")
    );
}

/// Equivalent to the default: the resolver must not disturb the common single-binary case.
#[test]
fn recorded_path_equal_to_the_default_resolves_to_the_default() {
    assert_eq!(
        resolve_recorded_executable(agent_path(), Some("agent")),
        agent_path()
    );
}
