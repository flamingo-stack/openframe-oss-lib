use super::*;

const FAILED_0_0_22_NO_HTTP: &str = "Connection FAILED: No HTTP response (fd=0, status=Complete/Disconnected, authState=0, connState=0, tls=down, elapsedMs=20016, attempt=ABCD1234-2100)";
const FAILED_0_0_22_TIMEOUT: &str = "Connection FAILED: Network timeout - server unreachable or gateway blocking (tls=down, elapsedMs=21016, attempt=ABCD1234-2101)";
const FAILED_0_0_23_PLUS: &str = "Connection FAILED (latest attempt): No HTTP response (fd=0, status=Complete/Disconnected, authState=0, connState=0, tls=down, elapsedMs=20016, attempt=ABCD1234-2102)";
const AUTHENTICATED: &str = "Server fully authenticated (authState=3)";
const CORE_OK_0_0_26: &str = "Received CoreOk from server (coreTimeout=0x0)";
const VERIFIED_0_0_27_LAUNCH: &str = "Server verified meshcore... Launching meshcore...";
const VERIFIED_0_0_27_RUNNING: &str = "Server verified meshcore... meshcore already running...";
// The 0.0.27 line as the client's stdout capture actually writes it: the agent's unterminated prefix, then the wrapped line.
const VERIFIED_0_0_27_AS_LOGGED: &str = "Server verified meshcore...2026-09-03T11:27:28.412Z INFO Server verified meshcore... Launching meshcore... tool_id=meshcentral-agent";

#[test]
fn failure_marker_matches_0_0_22_formats() {
    assert!(FAILED_0_0_22_NO_HTTP.contains(FAILURE_MARKER));
    assert!(FAILED_0_0_22_TIMEOUT.contains(FAILURE_MARKER));
}

#[test]
fn failure_marker_matches_0_0_23_plus_format() {
    assert!(FAILED_0_0_23_PLUS.contains(FAILURE_MARKER));
}

#[test]
fn markers_ignore_unrelated_lines() {
    for line in [
        "Connection: dialing uri=wss://x.openframe.ai/ws/tools/agent/meshcentral-server/agent.ashx host=x.openframe.ai port=443 family=IPv4 ip=1.2.3.4 useproxy=0 proxy=DIRECT attempt=ABCD1234-2103 suppressed=2",
        "AutoRetry Connect in 299066 milliseconds",
        "Control channel established [fd=12]",
        "Handshake: Server confirmed agent authentication (authState=1->3)",
        "Connection LOST: Disconnected after authentication (fd=12) - server closed connection",
        "Connection LOST: Disconnected before full authentication (fd=0, authState=1) - possible gateway/firewall issue",
        "Control channel disconnected [fd=12, authState=3]",
    ] {
        assert!(!line.contains(FAILURE_MARKER), "{line}");
        assert!(!is_healthy_line(line), "{line}");
    }
}

#[test]
fn healthy_markers_cover_every_agent_generation() {
    for line in [
        AUTHENTICATED,
        CORE_OK_0_0_26,
        VERIFIED_0_0_27_LAUNCH,
        VERIFIED_0_0_27_RUNNING,
        VERIFIED_0_0_27_AS_LOGGED,
    ] {
        assert!(is_healthy_line(line), "{line}");
    }
}

#[test]
fn busy_log_without_a_healthy_marker_still_counts_as_disconnected() {
    // The blind spot this branch exists for: chatty agent, no failure marker, no session.
    assert!(is_disconnected(
        Some(DISCONNECTED_DURATION),
        Duration::from_secs(0)
    ));
    assert!(!is_disconnected(
        Some(DISCONNECTED_DURATION - Duration::from_secs(1)),
        Duration::from_secs(0)
    ));
}

#[test]
fn watcher_uptime_is_the_grace_window_before_any_marker() {
    assert!(!is_disconnected(None, Duration::from_secs(0)));
    assert!(!is_disconnected(
        None,
        DISCONNECTED_DURATION - Duration::from_secs(1)
    ));
    assert!(is_disconnected(None, DISCONNECTED_DURATION));
}

#[test]
fn a_recent_healthy_marker_outranks_a_long_watch() {
    assert!(!is_disconnected(
        Some(Duration::from_secs(0)),
        DISCONNECTED_DURATION * 10
    ));
}

#[test]
fn cooldown_backs_off_then_caps() {
    assert_eq!(cooldown_for(0), ACTION_COOLDOWN);
    assert_eq!(cooldown_for(1), ACTION_COOLDOWN * 2);
    let capped = ACTION_COOLDOWN * 2u32.pow(MAX_COOLDOWN_BACKOFF_SHIFT);
    assert_eq!(cooldown_for(MAX_COOLDOWN_BACKOFF_SHIFT), capped);
    assert_eq!(cooldown_for(MAX_COOLDOWN_BACKOFF_SHIFT + 1), capped);
    assert_eq!(cooldown_for(u32::MAX), capped);
}

#[tokio::test]
async fn tail_seed_reports_last_marker() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("meshcentral-agent.log");

    assert_eq!(last_marker_in_tail(&path).await, None);

    tokio::fs::write(&path, "startup\nno markers here\n")
        .await
        .unwrap();
    assert_eq!(last_marker_in_tail(&path).await, None);

    tokio::fs::write(
        &path,
        format!("{FAILED_0_0_22_NO_HTTP}\n{CORE_OK_0_0_26}\n"),
    )
    .await
    .unwrap();
    assert_eq!(last_marker_in_tail(&path).await, Some(true));

    // A 0.0.27 agent recovering from the hourly recycle: the new wording must clear the failure just like CoreOk did.
    tokio::fs::write(
        &path,
        format!("{FAILED_0_0_23_PLUS}\n{AUTHENTICATED}\n{VERIFIED_0_0_27_AS_LOGGED}\n"),
    )
    .await
    .unwrap();
    assert_eq!(last_marker_in_tail(&path).await, Some(true));

    tokio::fs::write(
        &path,
        format!("{CORE_OK_0_0_26}\n{FAILED_0_0_23_PLUS}\n{FAILED_0_0_22_TIMEOUT}\n"),
    )
    .await
    .unwrap();
    assert_eq!(last_marker_in_tail(&path).await, Some(false));
}
