use super::*;
use std::cell::Cell;

const KEEP: Duration = Duration::from_secs(300);
const POLL: Duration = Duration::from_secs(60);

#[tokio::test(start_paused = true)]
async fn a_ready_state_is_not_waited_for() {
    let start = Instant::now();
    let calls = Cell::new(0);

    let ready = wait_until(
        || {
            calls.set(calls.get() + 1);
            std::future::ready(true)
        },
        start + Duration::from_secs(600),
        KEEP,
        POLL,
    )
    .await;

    assert!(ready);
    assert_eq!(calls.get(), 1);
    assert_eq!(Instant::now(), start);
}

#[tokio::test(start_paused = true)]
async fn the_wait_ends_when_the_state_comes_or_the_kept_time_is_reached() {
    let start = Instant::now();
    let deadline = start + Duration::from_secs(600);
    let calls = Cell::new(0);

    let ready = wait_until(
        || {
            calls.set(calls.get() + 1);
            std::future::ready(calls.get() == 3)
        },
        deadline,
        KEEP,
        POLL,
    )
    .await;
    assert!(ready);
    assert_eq!(calls.get(), 3);
    assert_eq!(Instant::now() - start, 2 * POLL);

    let never = wait_until(|| std::future::ready(false), deadline, KEEP, POLL).await;
    assert!(!never);
    let left = deadline.saturating_duration_since(Instant::now());
    assert!(left >= KEEP, "waited into the kept time: {left:?} left");
    assert!(left < KEEP + POLL, "gave up early: {left:?} left");
}
