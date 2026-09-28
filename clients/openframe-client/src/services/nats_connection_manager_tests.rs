use super::*;

/// The window must widen fast enough that a permanently broken connector stops leaking a task
/// every 90s, and must stop at the ceiling rather than growing without bound.
#[test]
fn stall_window_widens_then_caps() {
    let mut window = MIN_STALL_WINDOW;
    assert_eq!(window, Duration::from_secs(90));

    window = widen_stall_window(window);
    assert_eq!(window, Duration::from_secs(270));

    window = widen_stall_window(window);
    assert_eq!(window, Duration::from_secs(810));

    window = widen_stall_window(window);
    assert_eq!(window, MAX_STALL_WINDOW);

    // Already at the ceiling: further replacements must not push it past it.
    window = widen_stall_window(window);
    assert_eq!(window, MAX_STALL_WINDOW);
}

/// The whole predicate rests on this clock, so a recorded sign of life must read as recent and
/// an old one must read as stale.
#[test]
fn activity_clock_tracks_the_last_sign_of_life() {
    let clock = Mutex::new(Instant::now() - Duration::from_secs(600));
    assert!(since_activity(&clock) >= Duration::from_secs(600));

    note_activity(&clock);
    assert!(since_activity(&clock) < Duration::from_secs(1));
}

/// A connector that is still attempting must never be replaced, however long the outage runs —
/// this is what keeps a multi-hour network outage from turning into a replacement loop.
#[test]
fn a_ticking_connector_is_never_stale() {
    let clock = Mutex::new(Instant::now() - Duration::from_secs(5));
    assert!(since_activity(&clock) < MIN_STALL_WINDOW);
}

/// A connector showing no activity past the window is what the watchdog acts on.
#[test]
fn a_silent_connector_is_stale_past_the_window() {
    let clock = Mutex::new(Instant::now() - Duration::from_secs(120));
    assert!(since_activity(&clock) >= MIN_STALL_WINDOW);
}

/// The suspended backoff is longer than the stall window, so the grace span that covers leaving
/// suspension has to outlast it or a merely sleeping connector reads as stalled.
#[test]
fn suspension_grace_outlasts_the_stall_window() {
    assert!(SUSPENDED_RECONNECT_DELAY > MIN_STALL_WINDOW);
}

/// The gap guard only distinguishes "the watchdog was descheduled" from ordinary jitter if it
/// sits above the sampling period.
#[test]
fn probe_gap_guard_is_above_the_sampling_period() {
    assert!(MAX_PROBE_GAP > PROBE_INTERVAL);
}

/// Sustained health is what earns the window back. One healthy sample must not, or a client that
/// connects and stalls again would reset the window every cycle and leak a task forever.
#[test]
fn one_healthy_sample_does_not_earn_the_window_back() {
    let just_now = Instant::now();
    assert!(just_now.elapsed() < MIN_STALL_WINDOW);

    let sustained = Instant::now() - MIN_STALL_WINDOW;
    assert!(sustained.elapsed() >= MIN_STALL_WINDOW);
}
