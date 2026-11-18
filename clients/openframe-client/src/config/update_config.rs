// Download settings
pub const DOWNLOAD_RETRY_BUDGET_SECS: u64 = 240; // all attempts of one download, below CLIENT_UPDATE_PENDING_TTL_SECS
pub const DOWNLOAD_RETRY_INITIAL_DELAY_SECS: u64 = 5;
pub const DOWNLOAD_RETRY_MAX_DELAY_SECS: u64 = 60;
pub const MIN_BINARY_SIZE_BYTES: u64 = 1024 * 100; // 100 KB

// HTTP client timeouts
pub const HTTP_CLIENT_TIMEOUT_SECS: u64 = 120; // control-plane (auth, registration, heartbeat, key fetch)
pub const AWAITING_AUTH_POLL_SECS: u64 = 15; // unauthenticated service polling for the config `auth` writes
pub const DOWNLOAD_CLIENT_TIMEOUT_SECS: u64 = 300; // binary downloads (GitHub, tool API)

// Reconnection
pub const RECONNECTION_DELAY_MS: u64 = 5000; // 5 seconds

pub const SELF_RESTART_EXIT_CODE: i32 = 75;
pub const SELF_RESTART_IDLE_WAIT_SECS: u64 = 600;
pub const SELF_RESTART_IDLE_POLL_SECS: u64 = 5;
pub const SELF_RESTART_HANDOFF_SECS: u64 = 900;
pub const DEV_CLIENT_VERSION: &str = "0.0.0-dev";

// Durable result outbox
pub const OUTBOX_MAX_ENTRIES: usize = 500;
pub const OUTBOX_FLUSH_INTERVAL_SECS: u64 = 30;
pub const FLUSH_PUBLISH_TIMEOUT_SECS: u64 = 30;
// Outlives the longest backend delivery ttl-seconds (30 days), so a repeated dispatch is still recognised
pub const DELIVERY_LEDGER_TTL_SECS: u64 = 31 * 24 * 60 * 60;
// In-memory retry when the durable store is unavailable (redb failed to open).
pub const FALLBACK_PUBLISH_INITIAL_RETRY_DELAY_MS: u64 = 1000;
pub const FALLBACK_PUBLISH_MAX_RETRY_DELAY_MS: u64 = 30000;
// Bounded so a permanent publish failure (e.g. missing stream) cannot pile up
// detached tasks; ~8 min of retrying with the backoff above.
pub const FALLBACK_PUBLISH_MAX_RETRIES: u32 = 20;

pub const NATS_PAYLOAD_FALLBACK_BYTES: usize = 5 * 1024 * 1024;
pub const NATS_PAYLOAD_HEADROOM_BYTES: usize = 64 * 1024;

// Last-known-good update ratchet
/// How long the updater waits for the new binary's boot marker.
pub const BOOT_MARKER_WAIT_SECS: u64 = 90;
/// Unverified boots tolerated before an update is treated as failed.
pub const CRASH_LOOP_MAX_BOOT_ATTEMPTS: u32 = 3;
/// Refuse client updates below the LKG anchor and tool updates below the installed version (flip to force a downgrade).
pub const ALLOW_DOWNGRADE: bool = false;
/// Updater transcripts kept after pruning; one is written per update attempt.
pub const UPDATER_TRANSCRIPTS_KEPT: usize = 5;
/// Minimum age before a temp update leftover is swept (a live updater's files are younger).
pub const TEMP_LEFTOVER_MIN_AGE_SECS: u64 = 3600;
/// How long the started staged binary may take to answer `--version`; an antivirus scan inside the process start is not counted.
pub const STAGED_VERSION_PROBE_TIMEOUT_SECS: u64 = 30;

// Client-before-tool update ordering
pub const CLIENT_UPDATE_PENDING_TTL_SECS: u64 = 300;
