use std::sync::Arc;

use chrono::{DateTime, SecondsFormat, Utc};
use tokio::sync::Notify;
use tracing::{error, info};

use super::orders::Order;
use crate::models::{
    package_update_status_subject, Done, FailReason, Failed, PackageRef, PackageUpdateMessage,
    PackageUpdateStatusMessage, UpdateSource, UpdateStatus, Waiting,
};
use crate::services::nats_message_publisher::NatsMessagePublisher;
use crate::services::package_manager::status_outbox::StatusOutbox;
use crate::services::result_store::ResultStore;

const OUTBOX_KIND: &str = "package-update-status";

pub(super) enum Report {
    Waiting(Waiting),
    Done(Done),
    Failed(Failed),
}

#[derive(Clone)]
pub struct StatusReporter {
    sink: Sink,
}

#[derive(Clone)]
enum Sink {
    Outbox(Arc<StatusOutbox>),
    #[cfg(test)]
    Memory(Arc<std::sync::Mutex<Vec<PackageUpdateStatusMessage>>>),
}

impl StatusReporter {
    pub fn new(
        publisher: NatsMessagePublisher,
        store: Arc<ResultStore>,
        flush: Arc<Notify>,
    ) -> Self {
        Self {
            sink: Sink::Outbox(Arc::new(StatusOutbox::new(publisher, store, flush))),
        }
    }

    #[cfg(test)]
    pub(crate) fn in_memory() -> (Self, Arc<std::sync::Mutex<Vec<PackageUpdateStatusMessage>>>) {
        let events = Arc::new(std::sync::Mutex::new(Vec::new()));
        (
            Self {
                sink: Sink::Memory(events.clone()),
            },
            events,
        )
    }

    pub(super) async fn report(&self, event: PackageUpdateStatusMessage) {
        info!(
            request_id = %event.request_id,
            state = ?event.state,
            waiting = ?event.waiting,
            done = ?event.done,
            failed = ?event.failed,
            "Package update status"
        );
        match &self.sink {
            Sink::Outbox(outbox) => {
                let subject = package_update_status_subject(&event.machine_id);
                match serde_json::to_vec(&event) {
                    Ok(bytes) => {
                        outbox
                            .publish(OUTBOX_KIND, subject, &event.event_id, bytes)
                            .await
                    }
                    Err(e) => error!("Cannot serialize a package update status event: {:#}", e),
                }
            }
            #[cfg(test)]
            Sink::Memory(events) => events
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner)
                .push(event),
        }
    }

    /// The pending order was replaced by a newer request for the same package.
    pub async fn report_superseded(&self, machine_id: &str, order: &Order) {
        let failed = Failed {
            reason: FailReason::Superseded,
            exit_code: None,
            message: Some("replaced by a newer request for the same package".to_string()),
        };
        self.report(build(
            machine_id,
            &order.request_id,
            &order.source,
            &order.package,
            None,
            None,
            Report::Failed(failed),
        ))
        .await;
    }

    /// An order refused before it was taken in, so the backend still learns how it ended.
    pub async fn report_rejected(
        &self,
        machine_id: &str,
        message: &PackageUpdateMessage,
        reason: FailReason,
        detail: String,
    ) {
        let failed = Failed {
            reason,
            exit_code: None,
            message: Some(detail),
        };
        self.report(build(
            machine_id,
            &message.request_id,
            &message.source,
            &message.package,
            None,
            None,
            Report::Failed(failed),
        ))
        .await;
    }
}

pub(super) fn build(
    machine_id: &str,
    request_id: &str,
    source: &UpdateSource,
    package: &PackageRef,
    installed_version: Option<&str>,
    available_version: Option<&str>,
    report: Report,
) -> PackageUpdateStatusMessage {
    let mut event = PackageUpdateStatusMessage {
        event_id: uuid::Uuid::new_v4().to_string(),
        request_id: request_id.to_string(),
        machine_id: machine_id.to_string(),
        at: Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true),
        source: source.clone(),
        package: package.clone(),
        installed_version: installed_version.map(str::to_string),
        available_version: available_version.map(str::to_string),
        state: UpdateStatus::Waiting,
        waiting: None,
        done: None,
        failed: None,
    };
    match report {
        Report::Waiting(waiting) => event.waiting = Some(waiting),
        Report::Done(done) => {
            event.state = UpdateStatus::Done;
            event.done = Some(done);
        }
        Report::Failed(failed) => {
            event.state = UpdateStatus::Failed;
            event.failed = Some(failed);
        }
    }
    event
}

pub(super) fn rfc3339(unix_secs: u64) -> String {
    DateTime::<Utc>::from_timestamp(unix_secs as i64, 0)
        .map(|at| at.to_rfc3339_opts(SecondsFormat::Secs, true))
        .unwrap_or_default()
}

#[cfg(test)]
#[path = "status_tests.rs"]
mod tests;
