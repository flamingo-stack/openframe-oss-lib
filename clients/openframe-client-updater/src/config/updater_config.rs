// Download retry settings
pub const MAX_DOWNLOAD_RETRIES: u32 = 3;
/// Per-attempt cap; the retry loop stops early once DOWNLOAD_TOTAL_BUDGET_SECS
/// is spent so retries can never push the update past its ACK window.
pub const DOWNLOAD_TIMEOUT_SECS: u64 = 180;
/// Whole download phase (all attempts, backoff and CDN fallback included).
/// Must stay below CLIENT_UPDATE_ACK_WAIT_SECS minus the post-download work.
pub const DOWNLOAD_TOTAL_BUDGET_SECS: u64 = 360;
/// The download service's own HTTP client budget — must not be lower than
/// DOWNLOAD_TIMEOUT_SECS or the reqwest timeout fires first and shrinks the
/// download window (the general-purpose client keeps its shorter timeout).
pub const DOWNLOAD_CLIENT_TIMEOUT_SECS: u64 = 300;
pub const MIN_BINARY_SIZE_BYTES: u64 = 100 * 1024; // 100 KB

// NATS consumer settings
pub const CLIENT_UPDATE_STREAM: &str = "CLIENT_UPDATE";
/// Must comfortably exceed a normal update's time-to-ACK, i.e. DOWNLOAD_TOTAL_BUDGET_SECS
/// plus tool-op quiesce wait, service stop, swap, start settle and boot-marker wait
/// (roughly 360 + 60 + 30 + 10 + 3 + 90 = 553s). At 120s the same message was
/// redelivered mid-update and killed the observation window right after boot.
pub const CLIENT_UPDATE_ACK_WAIT_SECS: u64 = 600;
pub const CLIENT_UPDATE_MAX_DELIVER: i64 = 10;
pub const RECONNECTION_DELAY_MS: u64 = 5000;

// Consumer creation retry settings
pub const CONSUMER_RETRY_ATTEMPTS_PER_CYCLE: u32 = 5;
pub const CONSUMER_INITIAL_RETRY_DELAY_MS: u64 = 1000;
pub const CONSUMER_MAX_RETRY_DELAY_MS: u64 = 30000;
pub const CONSUMER_CYCLE_PAUSE_MS: u64 = 30000;

// Service stop/start timeouts
pub const SERVICE_STOP_TIMEOUT_SECS: u64 = 30;

// After starting the client service, wait this long before checking Running state
pub const SERVICE_START_VERIFY_WAIT_SECS: u64 = 5;
/// Service-state queries that error (SCM/launchctl hiccup, e.g. right after a
/// reboot) are retried this many times before the state is treated as unknown.
pub const SERVICE_STATE_QUERY_ATTEMPTS: u32 = 3;
pub const SERVICE_STATE_QUERY_RETRY_DELAY_SECS: u64 = 2;

// Client tool-op quiescence: openframe-client mirrors its in-flight tool
// operations (install/update/uninstall/restart) to {secured}/tool_ops_in_flight.json.
// Stopping the client mid-install would strand the tool record in Installing
// and orphan its children, so the swap waits for the file to empty.
pub const TOOL_OPS_IN_FLIGHT_FILE_NAME: &str = "tool_ops_in_flight.json";
/// How long to wait for the client's tool operations to drain before stopping it.
pub const TOOL_OP_QUIESCE_WAIT_SECS: u64 = 60;
pub const TOOL_OP_QUIESCE_POLL_INTERVAL_SECS: u64 = 2;
/// A marker untouched for longer than this is ignored (client died mid-op).
pub const TOOL_OPS_IN_FLIGHT_STALE_SECS: u64 = 30 * 60;

// Last-known-good update ratchet — parity with the in-client updater (Hotfix #2169).
/// How long to wait for the new client binary to write its boot marker.
pub const BOOT_MARKER_WAIT_SECS: u64 = 90;
/// Poll interval while waiting for the boot marker.
pub const BOOT_MARKER_POLL_INTERVAL_SECS: u64 = 2;
/// Settle time between service start and the first Running-state check.
pub const SERVICE_START_SETTLE_SECS: u64 = 3;
/// Refuse update messages below the LKG anchor (flip to force a downgrade).
pub const ALLOW_DOWNGRADE: bool = false;
/// Attempts to restore a binary during rollback (file may be briefly locked).
pub const ROLLBACK_RESTORE_ATTEMPTS: u32 = 3;
/// Delay between rollback restore attempts.
pub const ROLLBACK_RESTORE_RETRY_DELAY_SECS: u64 = 2;

// Post-boot observation — automatic rollback when the new client degrades
// after a verified boot (stops running, crash-loops). The anchor is promoted
// only after the window passes, so a backend-pushed downgrade is never blocked
// by a bad version that slipped past the boot check.
/// How long to watch the new client after its boot marker verified.
pub const POST_BOOT_OBSERVATION_SECS: u64 = 600;
/// Poll interval during the observation window.
pub const POST_BOOT_POLL_INTERVAL_SECS: u64 = 10;
/// Client restarts (boot-marker rewrites) tolerated inside the window.
pub const OBSERVATION_MAX_CLIENT_RESTARTS: u32 = 3;

// Atomic binary replace: retries with backoff on Windows file locking
pub const REPLACE_MAX_RETRIES: u32 = 10;
pub const REPLACE_RETRY_DELAY_MS: u64 = 500;

// Updater log file: rotated in place (openframe-client tails the fixed path and
// resets its offset when the file shrinks).
pub const UPDATER_LOG_MAX_BYTES: u64 = 10 * 1024 * 1024;
pub const UPDATER_LOG_KEEP_ROTATED: usize = 3;

// The service name of the main client — used by ServiceManagerService to stop/start it
pub const CLIENT_SERVICE_FULL_NAME: &str = "com.openframe.client";

// The updater's own service name
pub const UPDATER_SERVICE_FULL_NAME: &str = "com.openframe.client-updater";

pub const UPDATER_VERSION: &str = env!("OPENFRAME_UPDATER_VERSION");
