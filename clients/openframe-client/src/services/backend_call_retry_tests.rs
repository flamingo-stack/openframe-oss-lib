use super::*;
use crate::test_support::{directories, FAST};
use std::sync::atomic::{AtomicUsize, Ordering};

fn healthy_deactivation(dir: &tempfile::TempDir) -> std::sync::Arc<DeactivationService> {
    DeactivationService::new(&directories(dir))
}

#[tokio::test]
async fn first_success_is_returned_after_one_attempt() {
    let dir = tempfile::tempdir().unwrap();
    let attempts = AtomicUsize::new(0);

    let value = retry_until_settled(&healthy_deactivation(&dir), FAST, "test", || async {
        attempts.fetch_add(1, Ordering::SeqCst);
        Ok(7)
    })
    .await;

    assert_eq!(value, 7);
    assert_eq!(attempts.load(Ordering::SeqCst), 1);
}

#[tokio::test]
async fn failures_are_retried_until_an_attempt_succeeds() {
    let dir = tempfile::tempdir().unwrap();
    let attempts = AtomicUsize::new(0);

    let value = retry_until_settled(&healthy_deactivation(&dir), FAST, "test", || async {
        match attempts.fetch_add(1, Ordering::SeqCst) {
            0..=2 => anyhow::bail!("transient"),
            n => Ok(n),
        }
    })
    .await;

    assert_eq!(value, 3);
    assert_eq!(attempts.load(Ordering::SeqCst), 4);
}

#[test]
fn backoff_doubles_up_to_the_cap() {
    let timing = RetryTiming {
        initial: Duration::from_secs(30),
        max: Duration::from_secs(30 * 60),
    };
    let mut delay = timing.initial;
    let mut delays = vec![delay];
    for _ in 0..7 {
        delay = timing.next(delay);
        delays.push(delay);
    }
    let secs: Vec<u64> = delays.iter().map(Duration::as_secs).collect();
    assert_eq!(secs, [30, 60, 120, 240, 480, 960, 1800, 1800]);
}

#[test]
fn fixed_timing_never_grows() {
    let timing = RetryTiming::fixed(Duration::from_secs(60));
    assert_eq!(timing.next(timing.initial), Duration::from_secs(60));
}
