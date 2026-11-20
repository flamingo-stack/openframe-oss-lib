#[cfg(target_os = "macos")]
mod brew;
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
mod check;

use std::collections::{HashSet, VecDeque};
use std::future::Future;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, PoisonError};

use chrono::{SecondsFormat, Utc};
use tokio::sync::Notify;
use tokio::task::JoinHandle;
use tokio::time::{sleep, Duration, Instant};
use tracing::{error, info, warn};

use super::brew::BrewLock;
use super::package_update::RestartSignals;
use super::status_outbox::StatusOutbox;
use crate::models::{
    delivery_result_subject, package_adopt_status_subject, AdoptFailReason, AdoptOutcome,
    AdoptState, DeliveryRef, DeliveryResultMessage, PackageAdoptMessage, PackageAdoptStatusMessage,
};
#[cfg(target_os = "macos")]
use crate::models::{BrewKind, PackageRef};
use crate::services::nats_message_publisher::NatsMessagePublisher;
#[cfg(target_os = "macos")]
use crate::services::package_manager::{is_supported, ManagerId};
use crate::services::result_store::ResultStore;
use crate::utils::in_progress::{InProgress, InProgressGuard};

const OUTBOX_KIND: &str = "package-adopt-status";
const BACKEND_RESULT_TIMEOUT: Duration = Duration::from_secs(1800);

pub struct PackageAdoptRunner {
    shared: Arc<Shared>,
    started: AtomicBool,
}

struct Shared {
    queue: Mutex<Queue>,
    queued: Notify,
    status: StatusOutbox,
    store: Arc<ResultStore>,
    install: InstallGate,
    brew: BrewLock,
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
    deadline: Instant,
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
    pub(crate) fn new(
        publisher: NatsMessagePublisher,
        store: Arc<ResultStore>,
        flush: Arc<Notify>,
        signals: RestartSignals,
        package_upgrades: InProgress,
        brew: BrewLock,
    ) -> Self {
        Self {
            shared: Arc::new(Shared {
                queue: Mutex::new(Queue::default()),
                queued: Notify::new(),
                status: StatusOutbox::new(publisher, store.clone(), flush),
                store,
                install: InstallGate {
                    signals,
                    package_upgrades,
                },
                brew,
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
                deadline: Instant::now() + BACKEND_RESULT_TIMEOUT,
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
        let (adoption, running) =
            adopt(&job.order, &shared.install, &shared.brew, job.deadline).await;
        shared.report(&job, adoption).await;
        shared.handled(&job).await;
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
    brew: &BrewLock,
    deadline: Instant,
) -> (Result<AdoptOutcome, Refusal>, Option<InProgressGuard>) {
    match &order.package {
        #[cfg(target_os = "macos")]
        PackageRef::Brew {
            kind: BrewKind::Cask,
            name,
        } if is_supported(ManagerId::Brew) => {
            brew::adopt(name, order, install, brew, deadline).await
        }
        package => (
            Err(Refusal::new(
                AdoptFailReason::NotSupported,
                format!("{package:?} is not adopted on this device"),
            )),
            None,
        ),
    }
}

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
async fn wait_until<F: Future<Output = bool>>(
    ready: impl Fn() -> F,
    deadline: Instant,
    keep: Duration,
    poll: Duration,
) -> bool {
    loop {
        if ready().await {
            return true;
        }
        if deadline.saturating_duration_since(Instant::now()) < keep + poll {
            return false;
        }
        sleep(poll).await;
    }
}

impl Shared {
    async fn handled(&self, job: &Job) {
        if !self.store.enabled() {
            return;
        }
        let recorded = self
            .store
            .delivery_record(
                delivery_result_subject(&job.machine_id),
                DeliveryResultMessage::done(job.delivery.clone()),
            )
            .await;
        if let Err(e) = recorded {
            warn!(
                dispatch_id = %job.delivery.dispatch_id,
                "Failed to keep the adoption as handled, the next start reports it lost: {:#}", e
            );
        }
    }

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

#[cfg(test)]
#[path = "mod_tests.rs"]
mod tests;
