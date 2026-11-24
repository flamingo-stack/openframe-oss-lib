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
        let _ = read(move || {
            let _ = started.send(());
            let _ = held.lock().unwrap().recv_timeout(BOUND);
            None
        })
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
            interval: NEVER,
            retry: SOON,
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
