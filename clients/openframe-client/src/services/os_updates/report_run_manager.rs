use std::thread;

use anyhow::{anyhow, Context, Result};
use tokio::sync::oneshot;
use tokio::time::{sleep, timeout, Duration};
use tracing::{error, info};

use super::report::report;
use super::report_publisher::OsUpdatesReportPublisher;
use crate::platform::os_updates;
use crate::platform::os_updates::windows::{Manageability, WindowsInventory};
use crate::utils::failure_log_backoff::FailureLogBackoff;

const TIMING: ReportTiming = ReportTiming {
    first: Duration::from_secs(120),
    interval: Duration::from_secs(3600),
    retry: Duration::from_secs(900),
};
const PUBLISH_TIMEOUT: Duration = Duration::from_secs(30);

type OsUpdates = (WindowsInventory, Manageability);

struct ReportTiming {
    first: Duration,
    interval: Duration,
    retry: Duration,
}

pub struct OsUpdatesReportRunManager {
    publisher: OsUpdatesReportPublisher,
}

impl OsUpdatesReportRunManager {
    pub fn new(publisher: OsUpdatesReportPublisher) -> Self {
        Self { publisher }
    }

    pub fn start(&self) {
        info!("Starting OS updates report run manager");

        tokio::spawn(run(self.publisher.clone(), os_updates::read, TIMING));
    }
}

async fn run(
    publisher: OsUpdatesReportPublisher,
    source: impl Fn() -> Option<OsUpdates> + Clone + Send + 'static,
    timing: ReportTiming,
) {
    let mut backoff = FailureLogBackoff::new();
    let mut logged_manageability = None;
    let mut delay = timing.first;

    loop {
        sleep(delay).await;

        let (inventory, manageability) = match read(source.clone()).await {
            Ok(Some(read)) => read,
            Ok(None) => {
                info!("OS updates are not reported on this OS");
                return;
            }
            Err(e) => {
                error!("Failed to read OS updates: {:#}", e);
                delay = timing.retry;
                continue;
            }
        };

        if logged_manageability.as_ref() != Some(&manageability) {
            log_manageability(&inventory, &manageability);
            logged_manageability = Some(manageability.clone());
        }

        match publish(&publisher, &inventory, &manageability).await {
            Ok(()) => {
                if let Some((failures, failing_for)) = backoff.record_success() {
                    info!(
                        failures,
                        ?failing_for,
                        "OS updates report is delivered again"
                    );
                }
                delay = timing.interval;
            }
            Err(e) => {
                let log = backoff.should_log();
                let failures = backoff.record_failure(log);
                if log {
                    error!(failures, "Failed to report OS updates: {:#}", e);
                }
                delay = timing.retry;
            }
        }
    }
}

async fn read(
    source: impl Fn() -> Option<OsUpdates> + Send + 'static,
) -> Result<Option<OsUpdates>> {
    let (sender, receiver) = oneshot::channel();
    thread::Builder::new()
        .name("os-updates-read".into())
        .spawn(move || {
            let _ = sender.send(source());
        })
        .context("spawn the reader thread")?;
    receiver.await.context("the reader thread ended early")
}

async fn publish(
    publisher: &OsUpdatesReportPublisher,
    inventory: &WindowsInventory,
    manageability: &Manageability,
) -> Result<()> {
    timeout(
        PUBLISH_TIMEOUT,
        publisher.publish(report(inventory, manageability)),
    )
    .await
    .map_err(|_| anyhow!("timed out after {PUBLISH_TIMEOUT:?}, NATS may be disconnected"))?
}

fn log_manageability(inventory: &WindowsInventory, manageability: &Manageability) {
    match manageability {
        Manageability::Manageable => info!("OS updates on this device are manageable"),
        Manageability::NotManageable { reasons } => info!(
            ?reasons,
            system = ?inventory.system,
            management = ?inventory.management,
            write_filter = ?inventory.write_filter,
            bitlocker = ?inventory.bitlocker,
            "OS updates on this device are not manageable"
        ),
    }
}

#[cfg(test)]
#[path = "report_run_manager_tests.rs"]
mod tests;
