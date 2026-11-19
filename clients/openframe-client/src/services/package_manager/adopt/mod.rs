#[cfg(target_os = "macos")]
mod brew;
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
mod check;

use std::collections::{HashSet, VecDeque};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, PoisonError};

use chrono::{SecondsFormat, Utc};
use tokio::sync::Notify;
use tokio::task::JoinHandle;
use tracing::{error, info, warn};

use super::package_update::RestartSignals;
use super::status_outbox::StatusOutbox;
use crate::models::{
    package_adopt_status_subject, AdoptFailReason, AdoptOutcome, AdoptState, DeliveryRef,
    DeliveryResultMessage, PackageAdoptMessage, PackageAdoptStatusMessage,
};
#[cfg(target_os = "macos")]
use crate::models::{BrewKind, PackageRef};
use crate::services::delivery_results::DeliveryResults;
use crate::services::nats_message_publisher::NatsMessagePublisher;
#[cfg(target_os = "macos")]
use crate::services::package_manager::{is_supported, ManagerId};
use crate::services::result_store::ResultStore;
use crate::utils::in_progress::{InProgress, InProgressGuard};

const OUTBOX_KIND: &str = "package-adopt-status";

pub struct PackageAdoptRunner {
    shared: Arc<Shared>,
    started: AtomicBool,
}

struct Shared {
    queue: Mutex<Queue>,
    queued: Notify,
    status: StatusOutbox,
    results: DeliveryResults,
    install: InstallGate,
}

#[derive(Default)]
struct Queue {
    waiting: VecDeque<Job>,
    running: Option<String>,
}

struct Job {
    machine_id: String,
    delivery: DeliveryRef,
    order: PackageAdoptMessage,
}

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
struct InstallGate {
    signals: RestartSignals,
    package_upgrades: InProgress,
}

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
impl InstallGate {
    fn enter(&self) -> Option<InProgressGuard> {
        let running = self.package_upgrades.begin();
        (!self.signals.pending()).then_some(running)
    }
}

struct Refusal {
    reason: AdoptFailReason,
    message: String,
}

impl Refusal {
    fn new(reason: AdoptFailReason, message: impl Into<String>) -> Self {
        Self {
            reason,
            message: message.into(),
        }
    }
}

impl PackageAdoptRunner {
    pub fn new(
        publisher: NatsMessagePublisher,
        store: Arc<ResultStore>,
        flush: Arc<Notify>,
        results: DeliveryResults,
        signals: RestartSignals,
        package_upgrades: InProgress,
    ) -> Self {
        Self {
            shared: Arc::new(Shared {
                queue: Mutex::new(Queue::default()),
                queued: Notify::new(),
                status: StatusOutbox::new(publisher, store, flush),
                results,
                install: InstallGate {
                    signals,
                    package_upgrades,
                },
            }),
            started: AtomicBool::new(false),
        }
    }

    pub fn start(&self) -> Option<JoinHandle<()>> {
        if self.started.swap(true, Ordering::AcqRel) {
            warn!("Package adoption worker already started");
            return None;
        }
        info!("Starting package adoption worker");
        Some(tokio::spawn(run(self.shared.clone())))
    }

    pub fn submit(&self, machine_id: &str, delivery: DeliveryRef, order: PackageAdoptMessage) {
        self.shared
            .queue
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .waiting
            .push_back(Job {
                machine_id: machine_id.to_string(),
                delivery,
                order,
            });
        self.shared.queued.notify_one();
    }

    pub fn owed(&self) -> HashSet<String> {
        let queue = self
            .shared
            .queue
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        queue
            .waiting
            .iter()
            .map(|job| job.delivery.dispatch_id.clone())
            .chain(queue.running.clone())
            .collect()
    }
}

async fn run(shared: Arc<Shared>) {
    loop {
        let Some(job) = shared.next() else {
            shared.queued.notified().await;
            continue;
        };
        info!(request_id = %job.order.request_id, package = ?job.order.package, "Adopting a package");
        let (adoption, running) = adopt(&job.order, &shared.install).await;
        shared.report(&job, adoption).await;
        shared
            .results
            .settle(&job.machine_id, DeliveryResultMessage::done(job.delivery))
            .await;
        drop(running);
        shared
            .queue
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .running = None;
    }
}

#[cfg_attr(not(target_os = "macos"), allow(unused_variables))]
async fn adopt(
    order: &PackageAdoptMessage,
    install: &InstallGate,
) -> (Result<AdoptOutcome, Refusal>, Option<InProgressGuard>) {
    match &order.package {
        #[cfg(target_os = "macos")]
        PackageRef::Brew {
            kind: BrewKind::Cask,
            name,
        } if is_supported(ManagerId::Brew) => brew::adopt(name, order, install).await,
        package => (
            Err(Refusal::new(
                AdoptFailReason::NotSupported,
                format!("{package:?} is not adopted on this device"),
            )),
            None,
        ),
    }
}

impl Shared {
    fn next(&self) -> Option<Job> {
        let mut queue = self.queue.lock().unwrap_or_else(PoisonError::into_inner);
        let job = queue.waiting.pop_front()?;
        queue.running = Some(job.delivery.dispatch_id.clone());
        Some(job)
    }

    async fn report(&self, job: &Job, adoption: Result<AdoptOutcome, Refusal>) {
        let (state, message) = match adoption {
            Ok(outcome) => (
                AdoptState::Done {
                    outcome,
                    restart_required: outcome == AdoptOutcome::Reinstalled,
                },
                done_message(outcome).to_string(),
            ),
            Err(refusal) => (
                AdoptState::Failed {
                    reason: refusal.reason,
                },
                refusal.message,
            ),
        };
        info!(request_id = %job.order.request_id, ?state, %message, "Package adoption status");
        let event = PackageAdoptStatusMessage {
            event_id: uuid::Uuid::new_v4().to_string(),
            request_id: job.order.request_id.clone(),
            machine_id: job.machine_id.clone(),
            at: Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true),
            state,
            message,
        };
        match serde_json::to_vec(&event) {
            Ok(bytes) => {
                self.status
                    .publish(
                        OUTBOX_KIND,
                        package_adopt_status_subject(&job.machine_id),
                        &event.event_id,
                        bytes,
                    )
                    .await
            }
            Err(e) => error!("Cannot serialize a package adoption status event: {:#}", e),
        }
    }
}

fn done_message(outcome: AdoptOutcome) -> &'static str {
    match outcome {
        AdoptOutcome::AdoptedInPlace => "Homebrew manages the installed app now",
        AdoptOutcome::Reinstalled => {
            "Reinstalled through Homebrew; the user should restart the app"
        }
        AdoptOutcome::AlreadyManaged => "Homebrew already manages this app",
    }
}
