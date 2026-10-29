// Download retry settings
pub const MAX_DOWNLOAD_RETRIES: u32 = 3;
/// Per-attempt cap; the retry loop stops early once DOWNLOAD_TOTAL_BUDGET_SECS
/// is spent so retries can never push the update past the delivery's result timeout.
pub const DOWNLOAD_TIMEOUT_SECS: u64 = 180;
/// Whole download phase (all attempts, backoff and CDN fallback included).
pub const DOWNLOAD_TOTAL_BUDGET_SECS: u64 = 360;
/// The download service's own HTTP client budget — must not be lower than
/// DOWNLOAD_TIMEOUT_SECS or the reqwest timeout fires first and shrinks the
/// download window (the general-purpose client keeps its shorter timeout).
pub const DOWNLOAD_CLIENT_TIMEOUT_SECS: u64 = 300;
pub const MIN_BINARY_SIZE_BYTES: u64 = 100 * 1024; // 100 KB

// Delivery engine: CLIENT_UPDATE deliveries on machine.{id}.client-update.v2,
// answered on machine.{id}.delivery.result.
pub const RECONNECTION_DELAY_MS: u64 = 5000;
pub const DELIVERY_LEDGER_FILE_NAME: &str = "updater_deliveries.json";
/// Outlives the backend's longest delivery ttl, so a repeated dispatch is still recognised.
pub const DELIVERY_LEDGER_TTL_SECS: i64 = 31 * 24 * 60 * 60;
pub const DELIVERY_LEDGER_MAX_SETTLED: usize = 100;
pub const RESULT_PUBLISH_TIMEOUT_SECS: u64 = 30;
/// How often results that did not reach the stream yet are published again.
pub const RESULT_RESEND_INTERVAL_SECS: u64 = 30;

// Service stop/start timeouts
pub const SERVICE_STOP_TIMEOUT_SECS: u64 = 30;

// After starting the client service, wait this long before checking Running state
pub const SERVICE_START_VERIFY_WAIT_SECS: u64 = 5;
/// Service-state queries that error (SCM/launchctl hiccup, e.g. right after a
/// reboot) are retried this many times before the state is treated as unknown.
pub const SERVICE_STATE_QUERY_ATTEMPTS: u32 = 3;
pub const SERVICE_STATE_QUERY_RETRY_DELAY_SECS: u64 = 2;

// Drain: while the state file shows `draining`, openframe-client takes no new work
// and waits for running tool operations and scripts, as before its own restart,
// then writes {secured}/client_drained with the update's started_at.
pub const CLIENT_DRAINED_FILE_NAME: &str = "client_drained";
/// The client gives running work 600 s (its SELF_RESTART_IDLE_WAIT_SECS) and then
/// confirms anyway; the updater waits a little longer before stopping it regardless.
pub const DRAIN_WAIT_SECS: u64 = 660;
pub const DRAIN_POLL_INTERVAL_SECS: u64 = 2;

/// openframe-client writes its version here on every boot, just before boot.marker,
/// to hand its updates to the updater. An older client that still updates itself
/// writes none, so the updater stays out of its way.
pub const CLIENT_UPDATE_DELEGATED_FILE_NAME: &str = "client_update_delegated";

// Boot verification: openframe-client writes {secured}/boot.marker with its
// version on every boot; a swap counts only once the new binary has written it.
/// How long to wait for the new client binary to write its boot marker.
pub const BOOT_MARKER_WAIT_SECS: u64 = 90;
/// Poll interval while waiting for the boot marker.
pub const BOOT_MARKER_POLL_INTERVAL_SECS: u64 = 2;
/// Settle time between service start and the first Running-state check.
pub const SERVICE_START_SETTLE_SECS: u64 = 3;
/// A request below the version the client booted with is answered done without
/// running, as openframe-client did (flip to allow downgrades).
pub const ALLOW_DOWNGRADE: bool = false;
/// Attempts to put the pre-swap backup back after a failed swap (file may be briefly locked).
pub const BACKUP_RESTORE_ATTEMPTS: u32 = 3;
/// Delay between backup restore attempts.
pub const BACKUP_RESTORE_RETRY_DELAY_SECS: u64 = 2;

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
