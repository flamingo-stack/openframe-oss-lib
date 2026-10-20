use std::time::{Duration, Instant};

use tokio::sync::mpsc;
use tracing::{info, warn};

use super::managers::{self, QueryError, UpgradeOutcome};
use super::plan::{self, Action};
use super::state::UpdateState;
use super::{unix_now, ForceRequest, Worker};
use crate::models::{PackageRef, PolicyEntry};
use crate::platform::user_session::console_logon_id;
use crate::services::package_manager::update_gate;
use crate::services::package_manager::{support, ManagerId, Presence};

const RETRY_SECS: u64 = 5 * 60;
const PASS_BUDGET: Duration = Duration::from_secs(60 * 60);

struct Due<'a> {
    entries: Vec<&'a PolicyEntry>,
    all_answered: bool,
}

struct Interrupted;

#[derive(Default)]
struct Tally {
    upgraded: usize,
    waiting: usize,
    deferred: usize,
    failed: usize,
}

impl Tally {
    fn count(&mut self, outcome: &UpgradeOutcome) {
        match outcome {
            UpgradeOutcome::Upgraded | UpgradeOutcome::AlreadyLatest => self.upgraded += 1,
            UpgradeOutcome::Deferred(_) => self.deferred += 1,
            UpgradeOutcome::Failed(_) => self.failed += 1,
        }
    }
}

impl Worker {
    /// One pass over the policy. Returns the earliest time the next due pass may start: `Some`
    /// only when a manager did not answer, so a logon pass is retried, not hammered.
    pub(super) async fn pass(
        &self,
        state: &mut UpdateState,
        force: &mut mpsc::Receiver<ForceRequest>,
    ) -> Option<u64> {
        let started = Instant::now();
        let now = unix_now();
        let logon = console_logon_id();
        let policy = self.store.entries();
        state.retain(&policy);

        let due = self.collect_due(&policy, state, now).await;
        let Ok(tally) = self
            .upgrade_due(&due.entries, state, force, started, now)
            .await
        else {
            info!("Agent restart pending, stopping the pass; it resumes after the restart");
            self.save(state);
            return None;
        };

        info!(
            outdated = due.entries.len(),
            upgraded = tally.upgraded,
            waiting = tally.waiting,
            deferred = tally.deferred,
            failed = tally.failed,
            all_answered = due.all_answered,
            elapsed = ?started.elapsed(),
            "Package auto-update pass done"
        );
        state.complete_pass(unix_now(), logon, due.all_answered);
        self.save(state);
        (!due.all_answered).then(|| unix_now() + RETRY_SECS)
    }

    async fn collect_due<'a>(
        &self,
        policy: &'a [PolicyEntry],
        state: &mut UpdateState,
        now: u64,
    ) -> Due<'a> {
        let mut due = Due {
            entries: Vec::new(),
            all_answered: true,
        };
        for manager in managers_in(policy) {
            if !support::is_supported(manager) {
                continue;
            }
            match manager.presence().await {
                Presence::Present => {}
                Presence::Absent => {
                    info!(?manager, "Package manager absent, skipping it this pass");
                    continue;
                }
                Presence::Unknown => {
                    info!(
                        ?manager,
                        "Package manager presence unknown, skipping it this pass"
                    );
                    due.all_answered = false;
                    continue;
                }
            }
            match managers::outdated(manager).await {
                Ok(outdated) => {
                    state.observe(policy, manager, &outdated, now);
                    due.entries
                        .extend(policy.iter().filter(|e| outdated.contains(&e.package)));
                }
                Err(QueryError::Unavailable(reason)) => {
                    info!(?manager, %reason, "Package manager unavailable for auto-update, skipping it this pass");
                }
                Err(QueryError::Failed(reason)) => {
                    warn!(?manager, %reason, "Outdated query failed, skipping the manager this pass");
                    due.all_answered = false;
                }
            }
        }
        due
    }

    async fn upgrade_due(
        &self,
        due: &[&PolicyEntry],
        state: &mut UpdateState,
        force: &mut mpsc::Receiver<ForceRequest>,
        started: Instant,
        now: u64,
    ) -> Result<Tally, Interrupted> {
        let mut tally = Tally::default();
        if due.is_empty() {
            return Ok(tally);
        }
        let packages: Vec<PackageRef> = due.iter().map(|e| e.package.clone()).collect();
        let prepared = update_gate::prepare(&packages).await;
        for entry in due {
            while let Ok((package, reply)) = force.try_recv() {
                let _ = reply.send(self.force(state, &package).await);
            }
            if self.signals.pending() {
                return Err(Interrupted);
            }
            if started.elapsed() >= PASS_BUDGET {
                info!("Pass budget spent, the rest waits for the next pass");
                break;
            }
            let gate = prepared.check_now(&entry.package).await;
            let since = state.outdated_since(&entry.package).unwrap_or(now);
            let outcome = match plan::decide(&gate, &entry.policy, since, unix_now()) {
                Action::Upgrade => self.upgrade(&entry.package).await,
                Action::Force => {
                    info!(package = ?entry.package, ?gate, "Force deadline passed, closing the app to upgrade");
                    self.force_upgrade(&entry.package, &gate.holder_pids())
                        .await
                }
                Action::Wait { force_at } => {
                    info!(package = ?entry.package, holders = ?gate.holder_pids(), ?force_at, "Waiting for the app to close");
                    tally.waiting += 1;
                    continue;
                }
            };
            info!(package = ?entry.package, ?outcome, "Upgrade finished");
            if matches!(
                outcome,
                UpgradeOutcome::Upgraded | UpgradeOutcome::AlreadyLatest
            ) {
                state.upgraded(&entry.package);
            }
            tally.count(&outcome);
        }
        Ok(tally)
    }
}

fn managers_in(policy: &[PolicyEntry]) -> Vec<ManagerId> {
    let mut managers: Vec<ManagerId> = policy.iter().map(|e| ManagerId::of(&e.package)).collect();
    managers.sort();
    managers.dedup();
    managers
}

#[cfg(test)]
#[path = "pass_tests.rs"]
mod tests;
