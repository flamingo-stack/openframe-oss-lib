use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use std::time::Instant;

use tempfile::TempDir;
use tokio::sync::mpsc::{unbounded_channel, UnboundedReceiver};

use super::super::report_publisher::tests::Backend;
use super::*;
use crate::platform::os_updates::windows::fixtures::manageable;
use crate::services::nats_message_publisher::NatsMessagePublisher;
use crate::test_support::{connection_manager, directories, registered_agent};

const BOUND: Duration = Duration::from_secs(10);
const QUIET: Duration = Duration::from_millis(300);
const NEVER: Duration = Duration::from_secs(3600);
const SOON: Duration = Duration::from_millis(50);

async fn disconnected() -> (TempDir, OsUpdatesReportPublisher) {
    let dir = tempfile::tempdir().unwrap();
    let directories = directories(&dir);
    let config = registered_agent(&directories).await;
    let manager = connection_manager("nats://127.0.0.1:9".into(), &directories, &config);
    let publisher = OsUpdatesReportPublisher::new(NatsMessagePublisher::new(manager), config);
    (dir, publisher)
}

fn readable() -> Option<OsUpdates> {
    Some((manageable(), Manageability::Manageable))
}

fn recorded(
    source: impl Fn(u32) -> Option<OsUpdates> + Clone + Send + 'static,
) -> (
    impl Fn() -> Option<OsUpdates> + Clone + Send + 'static,
    UnboundedReceiver<Instant>,
) {
    let (reads, received) = unbounded_channel();
    let count = Arc::new(AtomicU32::new(0));
    let recording = move || {
        let _ = reads.send(Instant::now());
        source(count.fetch_add(1, Ordering::SeqCst))
    };
    (recording, received)
}

async fn next(reads: &mut UnboundedReceiver<Instant>) -> Instant {
    timeout(BOUND, reads.recv())
        .await
        .expect("a read within the bound")
        .expect("the run manager is alive")
}

#[test]
fn the_cadence_is_the_agreed_one() {
    assert_eq!(TIMING.first, Duration::from_secs(120));
    assert_eq!(TIMING.interval, Duration::from_secs(3600));
    assert_eq!(TIMING.retry, Duration::from_secs(900));
    assert_eq!(TIMING.read_limit, Duration::from_secs(300));
}

#[tokio::test]
async fn the_first_read_waits_for_its_delay() {
    let (_dir, publisher) = disconnected().await;
    let (source, mut reads) = recorded(|_| readable());
    let started = Instant::now();

    let running = tokio::spawn(run(
        publisher,
        source,
        ReportTiming {
            first: QUIET,
            interval: NEVER,
            retry: NEVER,
            read_limit: BOUND,
        },
    ));

    assert!(next(&mut reads).await - started >= QUIET);
    running.abort();
}

#[tokio::test]
async fn a_report_that_is_not_delivered_is_read_again_after_the_retry_delay() {
    let (_dir, publisher) = disconnected().await;
    let (source, mut reads) = recorded(|_| readable());

    let running = tokio::spawn(run(
        publisher,
        source,
        ReportTiming {
            first: Duration::ZERO,
            interval: NEVER,
            retry: QUIET,
            read_limit: BOUND,
        },
    ));

    let first = next(&mut reads).await;
    let second = next(&mut reads).await;
    assert!(second - first >= QUIET);
    running.abort();
}

#[tokio::test]
async fn a_reader_that_panics_is_tried_again() {
    let (_dir, publisher) = disconnected().await;
    let (source, mut reads) = recorded(|read| match read {
        0 => panic!("the reader broke"),
        _ => readable(),
    });

    let running = tokio::spawn(run(
        publisher,
        source,
        ReportTiming {
            first: Duration::ZERO,
            interval: NEVER,
            retry: SOON,
            read_limit: BOUND,
        },
    ));

    next(&mut reads).await;
    next(&mut reads).await;
    assert!(!running.is_finished());
    running.abort();
}

#[tokio::test]
async fn an_os_without_a_reader_ends_the_run() {
    let (_dir, publisher) = disconnected().await;

    timeout(
        BOUND,
        run(
            publisher,
            || None,
            ReportTiming {
                first: Duration::ZERO,
                interval: SOON,
                retry: SOON,
                read_limit: BOUND,
            },
        ),
    )
    .await
    .expect("the run ends");
}

#[test]
fn a_read_in_progress_does_not_hold_the_runtime() {
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let (started, mut reading) = unbounded_channel();
    let (release, held) = std::sync::mpsc::channel::<()>();
    let held = Arc::new(std::sync::Mutex::new(held));
    runtime.spawn(async move {
        let _ = read(
            &InProgress::default(),
            move || {
                let _ = started.send(());
                let _ = held.lock().unwrap().recv_timeout(BOUND);
                None
            },
            NEVER,
        )
        .await;
    });
    runtime.block_on(async { reading.recv().await.unwrap() });

    let dropped = Instant::now();
    drop(runtime);

    assert!(
        dropped.elapsed() < BOUND / 2,
        "dropping the runtime waited for the reader"
    );
    drop(release);
}

#[tokio::test]
async fn a_delivered_report_is_repeated_after_the_interval() {
    let Some(backend) = Backend::start().await else {
        return;
    };
    backend.create_stream().await;
    let (source, mut reads) = recorded(|_| readable());

    let running = tokio::spawn(run(
        backend.publisher.clone(),
        source,
        ReportTiming {
            first: Duration::ZERO,
            interval: QUIET,
            retry: NEVER,
            read_limit: BOUND,
        },
    ));

    let first = next(&mut reads).await;
    let second = next(&mut reads).await;
    next(&mut reads).await;
    assert!(second - first >= QUIET);
    assert!(backend.stored_count().await >= 2);
    assert_eq!(backend.stored(1).await, backend.stored(2).await);
    running.abort();
}

#[tokio::test]
async fn a_report_is_delivered_once_the_backend_has_its_stream() {
    let Some(backend) = Backend::start().await else {
        return;
    };
    let (source, mut reads) = recorded(|_| readable());
    let running = tokio::spawn(run(
        backend.publisher.clone(),
        source,
        ReportTiming {
            first: Duration::ZERO,
            interval: SOON,
            retry: SOON,
            read_limit: BOUND,
        },
    ));
    next(&mut reads).await;
    next(&mut reads).await;

    backend.create_stream().await;

    timeout(BOUND, async {
        while backend.stored_count().await == 0 {
            next(&mut reads).await;
        }
    })
    .await
    .expect("the report is delivered");
    running.abort();
}

#[tokio::test]
async fn a_hung_read_is_given_up_and_not_started_twice() {
    let reads = InProgress::default();
    let (release, held) = std::sync::mpsc::channel::<()>();
    let held = Arc::new(std::sync::Mutex::new(held));
    let hanging = move || {
        let _ = held.lock().unwrap().recv_timeout(BOUND);
        readable()
    };

    let given_up = read(&reads, hanging, QUIET).await.unwrap_err();
    let refused = read(&reads, readable, BOUND).await.unwrap_err();
    release.send(()).unwrap();
    crate::test_support::wait_until(|| !reads.view().is_active()).await;
    let again = read(&reads, readable, BOUND).await.unwrap();

    assert_eq!(given_up.to_string(), "no answer within 300ms");
    assert_eq!(refused.to_string(), "the previous read has not finished");
    assert!(again.is_some());
}

#[tokio::test]
async fn an_unreadable_device_is_read_again_after_the_retry_delay() {
    let Some(backend) = Backend::start().await else {
        return;
    };
    backend.create_stream().await;
    let (source, mut reads) = recorded(|_| {
        Some((
            manageable(),
            Manageability::NotManageable {
                reasons: vec![NotManageableReason::Unreadable, NotManageableReason::Mdm],
            },
        ))
    });

    let running = tokio::spawn(run(
        backend.publisher.clone(),
        source,
        ReportTiming {
            first: Duration::ZERO,
            interval: NEVER,
            retry: QUIET,
            read_limit: BOUND,
        },
    ));

    let first = next(&mut reads).await;
    let second = next(&mut reads).await;
    assert!(second - first >= QUIET);
    assert!(backend.stored_count().await >= 1);
    running.abort();
}

#[test]
fn only_the_first_unsettled_report_is_retried_early() {
    let mut unsettled = false;
    let mut delays = Vec::new();
    for settled in [false, false, false, true, false, true, true] {
        delays.push(next_delay(&TIMING, &mut unsettled, settled));
    }
    assert_eq!(
        delays,
        [
            TIMING.retry,
            TIMING.interval,
            TIMING.interval,
            TIMING.interval,
            TIMING.retry,
            TIMING.interval,
            TIMING.interval
        ]
    );
}

#[tokio::test]
async fn a_backend_that_never_takes_the_report_is_not_hammered() {
    let (_dir, publisher) = disconnected().await;
    let (source, mut reads) = recorded(|_| readable());

    let running = tokio::spawn(run(
        publisher,
        source,
        ReportTiming {
            first: Duration::ZERO,
            interval: NEVER,
            retry: SOON,
            read_limit: BOUND,
        },
    ));

    next(&mut reads).await;
    next(&mut reads).await;
    assert!(timeout(QUIET * 2, reads.recv()).await.is_err());
    running.abort();
}

#[tokio::test]
async fn a_device_closed_for_a_lasting_reason_waits_the_interval() {
    let Some(backend) = Backend::start().await else {
        return;
    };
    backend.create_stream().await;
    let (source, mut reads) = recorded(|_| {
        Some((
            manageable(),
            Manageability::NotManageable {
                reasons: vec![NotManageableReason::Wsus],
            },
        ))
    });

    let running = tokio::spawn(run(
        backend.publisher.clone(),
        source,
        ReportTiming {
            first: Duration::ZERO,
            interval: NEVER,
            retry: SOON,
            read_limit: BOUND,
        },
    ));

    next(&mut reads).await;
    assert!(timeout(QUIET * 2, reads.recv()).await.is_err());
    assert_eq!(backend.stored_count().await, 1);
    running.abort();
}
