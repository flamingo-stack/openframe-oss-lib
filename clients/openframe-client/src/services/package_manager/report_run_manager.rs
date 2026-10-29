use super::report_publisher::PackageManagerReportPublisher;
use super::{ManagerId, PRESENCE_PROBE_TIMEOUT_SECS};
use std::sync::Arc;
use tokio::sync::Notify;
use tokio::time::{interval, timeout, Duration};
use tracing::{error, info};

const REPORT_INTERVAL: Duration = Duration::from_secs(900);
const PUBLISH_GRACE: Duration = Duration::from_secs(10);

fn report_timeout() -> Duration {
    let probes = ManagerId::ALL.len().max(1) as u64;
    Duration::from_secs(u64::from(PRESENCE_PROBE_TIMEOUT_SECS) * probes) + PUBLISH_GRACE
}

pub struct PackageManagerReportRunManager {
    publisher: PackageManagerReportPublisher,
    wake: Arc<Notify>,
}

impl PackageManagerReportRunManager {
    pub fn new(publisher: PackageManagerReportPublisher) -> Self {
        Self {
            publisher,
            wake: Arc::new(Notify::new()),
        }
    }

    pub fn wake_handle(&self) -> Arc<Notify> {
        self.wake.clone()
    }

    pub fn start(&self) {
        let publisher = self.publisher.clone();
        let wake = self.wake.clone();

        info!("Starting package manager report run manager");

        tokio::spawn(async move {
            let report_timeout = report_timeout();
            let mut ticker = interval(REPORT_INTERVAL.max(report_timeout + PUBLISH_GRACE));

            loop {
                tokio::select! {
                    _ = ticker.tick() => {}
                    _ = wake.notified() => {}
                }

                match timeout(report_timeout, publisher.publish()).await {
                    Ok(Ok(())) => {}
                    Ok(Err(e)) => error!("Failed to report package manager state: {}", e),
                    Err(_) => error!("Package manager report timed out"),
                }
            }
        });
    }
}
