use crate::services::device_data_fetcher::DeviceDataFetcher;
use crate::services::machine_timezone_publisher::MachineTimezonePublisher;
use crate::services::nats_connection_manager::NatsConnectionManager;
use tokio::sync::broadcast::error::RecvError;
use tokio::time::{interval, timeout, Duration};
use tracing::{error, info, warn};

const TIMEZONE_POLL_INTERVAL: Duration = Duration::from_secs(300);
const TIMEZONE_PUBLISH_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Clone)]
pub struct MachineTimezoneRunManager {
    publisher: MachineTimezonePublisher,
    device_data_fetcher: DeviceDataFetcher,
    nats_connection_manager: NatsConnectionManager,
}

impl MachineTimezoneRunManager {
    pub fn new(
        publisher: MachineTimezonePublisher,
        device_data_fetcher: DeviceDataFetcher,
        nats_connection_manager: NatsConnectionManager,
    ) -> Self {
        Self {
            publisher,
            device_data_fetcher,
            nats_connection_manager,
        }
    }

    pub fn start(&self) {
        let publisher = self.publisher.clone();
        let device_data_fetcher = self.device_data_fetcher.clone();
        let mut reconnect_rx = self.nats_connection_manager.subscribe_reconnect();

        info!("Starting machine timezone run manager");

        tokio::spawn(async move {
            let mut interval = interval(TIMEZONE_POLL_INTERVAL);
            let mut last_sent: Option<String> = None;

            loop {
                let on_reconnect = tokio::select! {
                    _ = interval.tick() => false,
                    received = reconnect_rx.recv() => match received {
                        Ok(()) | Err(RecvError::Lagged(_)) => true,
                        Err(RecvError::Closed) => {
                            error!("Reconnect channel closed, stopping machine timezone run manager");
                            return;
                        }
                    },
                };

                let Some(timezone) = device_data_fetcher.get_timezone() else {
                    warn!("Could not resolve system timezone - skipping timezone report");
                    continue;
                };

                if !on_reconnect && last_sent.as_deref() == Some(timezone.as_str()) {
                    continue;
                }

                match timeout(
                    TIMEZONE_PUBLISH_TIMEOUT,
                    publisher.publish_timezone(&timezone),
                )
                .await
                {
                    Ok(Ok(())) => last_sent = Some(timezone),
                    Ok(Err(e)) => error!("Failed to send timezone: {:#}", e),
                    Err(_) => error!("Timezone report timed out - NATS may be disconnected"),
                }
            }
        });
    }
}
