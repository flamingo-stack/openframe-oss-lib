use std::sync::Arc;

use tracing::{info, warn};

use super::managers::{self, ProbeState, QueryError, UpgradeOutcome, UPGRADE_TIMEOUT_SECS};
use super::orders::Order;
use super::status::{self, Report};
use super::{close, relaunch, Worker};
use crate::executor::console_user_present;
use crate::models::{
    Done, DoneResult, FailReason, Failed, HolderInfo, UpdateMode, WaitPhase, WaitReason, Waiting,
};
use crate::services::package_manager::update_gate::{
    self, BlockReason, GateDecision, Holder, Prepared, Undetermined,
};
use crate::services::package_manager::{ManagerId, Presence};
use crate::utils::in_progress::InProgressGuard;

/// How often a waiting order looks at the gate again.
pub(super) const POLL_SECS: u64 = 60;
/// How often a counting-down order looks for the app to quit on its own.
const COUNTDOWN_POLL_SECS: u64 = 10;
/// Retry spacing and budget while the manager is busy or a holder stays unseen.
const BUSY_RETRY_SECS: u64 = 5 * 60;
const BUSY_BUDGET_SECS: u64 = 60 * 60;
/// How long a manager's presence and outdated answer stay trusted.
const PROBE_TTL_SECS: u64 = 4 * 60 * 60;

/// What the worker remembers about one order between looks; lost on restart, so a countdown restarts in full.
#[derive(Default)]
pub(super) struct Progress {
    pub(super) revision: Option<u64>,
    present_at: Option<u64>,
    probe: Option<Probe>,
    prepared: Option<Arc<Prepared>>,
    countdown: Option<u64>,
    /// The apps a forced close stopped; relaunched once the order ends.
    closed: Vec<Holder>,
    busy_since: Option<u64>,
    unseen_since: Option<u64>,
    held: Hold,
    /// Set once a FORCE order installs without a visible gate; an in-use answer then ends it.
    blind: bool,
    last_report: Option<ReportKey>,
    /// Unix seconds before which the order is not looked at again.
    pub(super) next_at: u64,
}

struct Probe {
    installed: Option<String>,
    available: Option<String>,
    at: u64,
}

/// What a look ended up waiting on; the other clock is cleared when a look ends without it.
#[derive(Default, Clone, Copy, PartialEq, Eq)]
enum Hold {
    #[default]
    None,
    Busy,
    Unseen,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ReportKey {
    reason: WaitReason,
    phase: WaitPhase,
    holders: Vec<u32>,
    closes_at: Option<u64>,
}

pub(super) enum Verdict {
    Continue { next_at: u64 },
    Finished,
}

impl Worker {
    /// One look at an order: reports where it stands and installs when it may.
    pub(super) async fn look(
        &self,
        machine_id: &str,
        order: &Order,
        p: &mut Progress,
        now: u64,
    ) -> Verdict {
        p.held = Hold::None;
        let verdict = self.look_inner(machine_id, order, p, now).await;
        if p.held != Hold::Busy {
            p.busy_since = None;
        }
        if p.held != Hold::Unseen {
            p.unseen_since = None;
        }
        verdict
    }

    async fn look_inner(
        &self,
        machine_id: &str,
        order: &Order,
        p: &mut Progress,
        now: u64,
    ) -> Verdict {
        if p.revision != Some(order.revision) {
            p.revision = Some(order.revision);
            p.countdown = None;
            p.last_report = None;
            p.probe = None;
            p.prepared = None;
        }
        let manager = ManagerId::of(&order.package);
        if !console_user_present().await {
            return self.no_session(machine_id, order, p, now).await;
        }
        if p.present_at.is_none_or(|at| now >= at + PROBE_TTL_SECS) {
            match manager.presence().await {
                Presence::Present => p.present_at = Some(now),
                Presence::Absent => {
                    return self
                        .fail(
                            machine_id,
                            order,
                            p,
                            FailReason::ManagerMissing,
                            None,
                            format!("{manager:?} is not installed"),
                        )
                        .await
                }
                Presence::Unknown => {
                    return self
                        .busy(
                            machine_id,
                            order,
                            p,
                            now,
                            "the package manager could not be probed, no user session yet",
                        )
                        .await
                }
            }
        }
        if p.probe
            .as_ref()
            .is_none_or(|probe| now >= probe.at + PROBE_TTL_SECS)
        {
            match managers::probe(&order.package).await {
                Ok(found) => {
                    p.probe = Some(Probe {
                        installed: found.installed_version,
                        available: found.available_version,
                        at: now,
                    });
                    match found.state {
                        ProbeState::Outdated => {}
                        ProbeState::UpToDate => {
                            return self
                                .done(machine_id, order, p, DoneResult::AlreadyLatest, false)
                                .await
                        }
                        ProbeState::NotInstalled => {
                            return self
                                .fail(
                                    machine_id,
                                    order,
                                    p,
                                    FailReason::NotInstalled,
                                    None,
                                    format!("{manager:?} reports the package as not installed"),
                                )
                                .await
                        }
                        ProbeState::NotUpgradable(reason) => {
                            return self
                                .fail(
                                    machine_id,
                                    order,
                                    p,
                                    FailReason::NotUpgradable,
                                    None,
                                    reason,
                                )
                                .await
                        }
                    }
                }
                Err(QueryError::Unavailable(reason)) => {
                    return self
                        .fail(
                            machine_id,
                            order,
                            p,
                            FailReason::ManagerMissing,
                            None,
                            reason,
                        )
                        .await
                }
                Err(QueryError::Failed(reason)) => {
                    return self.busy(machine_id, order, p, now, &reason).await
                }
            }
        }

        let prepared = match &p.prepared {
            Some(prepared) => prepared.clone(),
            None => {
                let prepared = Arc::new(update_gate::prepare(&order.package).await);
                p.prepared = Some(prepared.clone());
                prepared
            }
        };
        match prepared.check_now().await {
            GateDecision::Clear => self.install(machine_id, order, p, now, None).await,
            GateDecision::Blocked(BlockReason::Running { holders }) => match order.mode {
                UpdateMode::Wait => {
                    self.report_waiting(
                        machine_id,
                        order,
                        p,
                        WaitReason::AppRunning,
                        WaitPhase::Prompt,
                        &holders,
                        None,
                    )
                    .await;
                    Verdict::Continue {
                        next_at: now + POLL_SECS,
                    }
                }
                UpdateMode::Force => self.countdown(machine_id, order, p, now, holders).await,
            },
            GateDecision::Blocked(BlockReason::Undetermined(reason)) => {
                // A failed resolution is not kept: the next look resolves the identity again.
                if matches!(reason, Undetermined::Resolver(_)) {
                    p.prepared = None;
                }
                self.undetermined(machine_id, order, p, now, reason).await
            }
        }
    }

    /// The gate cannot see the app: nothing to hold for some reasons, a transient failure for others.
    async fn undetermined(
        &self,
        machine_id: &str,
        order: &Order,
        p: &mut Progress,
        now: u64,
        reason: Undetermined,
    ) -> Verdict {
        match reason {
            Undetermined::NotInstalled
            | Undetermined::ManagerUnsupported
            | Undetermined::NoInstallLocation => {
                info!(request_id = %order.request_id, %reason, "Nothing to hold the update, installing");
                self.install(machine_id, order, p, now, None).await
            }
            reason => {
                let budget_spent = p
                    .busy_since
                    .is_some_and(|since| now >= since + BUSY_BUDGET_SECS);
                if order.mode == UpdateMode::Force && budget_spent {
                    warn!(request_id = %order.request_id, %reason, "Still cannot tell whether the app is running, forcing the install blind");
                    p.blind = true;
                    return self.install(machine_id, order, p, now, None).await;
                }
                self.busy(
                    machine_id,
                    order,
                    p,
                    now,
                    &format!("cannot tell whether the app is running: {reason}"),
                )
                .await
            }
        }
    }

    async fn countdown(
        &self,
        machine_id: &str,
        order: &Order,
        p: &mut Progress,
        now: u64,
        holders: Vec<Holder>,
    ) -> Verdict {
        let closes_at = *p
            .countdown
            .get_or_insert_with(|| now + order.countdown_seconds);
        if now < closes_at {
            self.report_waiting(
                machine_id,
                order,
                p,
                WaitReason::AppRunning,
                WaitPhase::Countdown,
                &holders,
                Some(closes_at),
            )
            .await;
            return Verdict::Continue {
                next_at: (now + COUNTDOWN_POLL_SECS).min(closes_at),
            };
        }
        info!(request_id = %order.request_id, ?holders, "Countdown over, closing the app to update it");
        // Held through the install: a restart between the close and the install would strand the user.
        let running = self.package_upgrades.begin();
        if self.signals.pending() {
            info!(request_id = %order.request_id, "Agent restart pending, the forced close waits for it");
            return Verdict::Continue {
                next_at: now + POLL_SECS,
            };
        }
        if !self.orders.start_installing(&order.request_id) {
            info!(request_id = %order.request_id, "Superseded before the forced close, dropping it");
            self.relaunch_closed(p).await;
            return Verdict::Finished;
        }
        let pids: Vec<u32> = holders.iter().map(|holder| holder.pid).collect();
        let survivors = close::close(&pids).await;
        p.countdown = None;
        p.closed = holders
            .into_iter()
            .filter(|holder| !survivors.contains(&holder.pid))
            .collect();
        if !survivors.is_empty() {
            return self
                .fail(
                    machine_id,
                    order,
                    p,
                    FailReason::CloseFailed,
                    None,
                    format!("still running after the forced close: {survivors:?}"),
                )
                .await;
        }
        self.install(machine_id, order, p, now, Some(running)).await
    }

    async fn install(
        &self,
        machine_id: &str,
        order: &Order,
        p: &mut Progress,
        now: u64,
        running: Option<InProgressGuard>,
    ) -> Verdict {
        // Held until the closed apps are back and the result is reported: both are lost on restart.
        let _running = match running {
            Some(running) => running,
            None => {
                let running = self.package_upgrades.begin();
                if self.signals.pending() {
                    info!(request_id = %order.request_id, "Agent restart pending, the update waits for it");
                    return Verdict::Continue {
                        next_at: now + POLL_SECS,
                    };
                }
                if !self.orders.start_installing(&order.request_id) {
                    info!(request_id = %order.request_id, "Superseded before its install, dropping it");
                    self.relaunch_closed(p).await;
                    return Verdict::Finished;
                }
                running
            }
        };
        let outcome = managers::upgrade(&order.package).await;
        info!(request_id = %order.request_id, ?outcome, "Package update attempt finished");
        let verdict = match outcome {
            UpgradeOutcome::Upgraded { reboot_required } => {
                self.read_installed(order, p, now).await;
                self.done(machine_id, order, p, DoneResult::Upgraded, reboot_required)
                    .await
            }
            UpgradeOutcome::AlreadyLatest => {
                self.read_installed(order, p, now).await;
                self.done(machine_id, order, p, DoneResult::AlreadyLatest, false)
                    .await
            }
            UpgradeOutcome::NotUpgradable(reason) => {
                self.fail(
                    machine_id,
                    order,
                    p,
                    FailReason::NotUpgradable,
                    None,
                    reason,
                )
                .await
            }
            UpgradeOutcome::InUse(reason) if !p.closed.is_empty() || p.blind => {
                self.fail(machine_id, order, p, FailReason::CloseFailed, None, reason)
                    .await
            }
            UpgradeOutcome::InUse(reason) => {
                p.held = Hold::Unseen;
                let since = *p.unseen_since.get_or_insert(now);
                if order.mode == UpdateMode::Force && now >= since + BUSY_BUDGET_SECS {
                    return self
                        .fail(machine_id, order, p, FailReason::CloseFailed, None, reason)
                        .await;
                }
                warn!(request_id = %order.request_id, %reason, "The app is in use by a process the gate did not see");
                self.report_waiting(
                    machine_id,
                    order,
                    p,
                    WaitReason::AppRunning,
                    WaitPhase::Prompt,
                    &[],
                    None,
                )
                .await;
                Verdict::Continue {
                    next_at: now + BUSY_RETRY_SECS,
                }
            }
            UpgradeOutcome::Busy(reason) => self.busy(machine_id, order, p, now, &reason).await,
            UpgradeOutcome::Failed { exit_code, message } => {
                self.fail(
                    machine_id,
                    order,
                    p,
                    FailReason::ManagerError,
                    Some(exit_code),
                    message,
                )
                .await
            }
            UpgradeOutcome::TimedOut => {
                self.fail(
                    machine_id,
                    order,
                    p,
                    FailReason::Timeout,
                    None,
                    format!("the package manager did not finish within {UPGRADE_TIMEOUT_SECS} s"),
                )
                .await
            }
        };
        // A finished order stays marked until finish() drops it; a waiting one may be superseded.
        if matches!(verdict, Verdict::Continue { .. }) {
            self.orders.stop_installing();
        }
        verdict
    }

    /// The versions the manager reports once it is done; the probe's target stands in when it cannot tell.
    async fn read_installed(&self, order: &Order, p: &mut Progress, now: u64) {
        let target = p.probe.take().and_then(|probe| probe.available);
        let (installed, available) = match managers::reread(&order.package).await {
            Ok(after) => (after.installed_version, after.available_version),
            Err(e) => {
                warn!(request_id = %order.request_id, ?e, "Could not read the version after the upgrade");
                (None, None)
            }
        };
        p.probe = Some(Probe {
            installed: installed.or_else(|| target.clone()),
            available: available.or(target),
            at: now,
        });
    }

    async fn busy(
        &self,
        machine_id: &str,
        order: &Order,
        p: &mut Progress,
        now: u64,
        reason: &str,
    ) -> Verdict {
        if !console_user_present().await {
            return self.no_session(machine_id, order, p, now).await;
        }
        p.held = Hold::Busy;
        let since = *p.busy_since.get_or_insert(now);
        if now >= since + BUSY_BUDGET_SECS {
            return self
                .fail(
                    machine_id,
                    order,
                    p,
                    FailReason::Timeout,
                    None,
                    format!("gave up after an hour: {reason}"),
                )
                .await;
        }
        info!(request_id = %order.request_id, %reason, "Package manager busy, retrying later");
        self.report_waiting(
            machine_id,
            order,
            p,
            WaitReason::ManagerBusy,
            WaitPhase::Prompt,
            &[],
            None,
        )
        .await;
        Verdict::Continue {
            next_at: now + BUSY_RETRY_SECS,
        }
    }

    /// Nothing can be probed or installed without a user; waits for a logon, outside the busy budget.
    async fn no_session(
        &self,
        machine_id: &str,
        order: &Order,
        p: &mut Progress,
        now: u64,
    ) -> Verdict {
        self.report_waiting(
            machine_id,
            order,
            p,
            WaitReason::NoUserSession,
            WaitPhase::Prompt,
            &[],
            None,
        )
        .await;
        Verdict::Continue {
            next_at: now + POLL_SECS,
        }
    }

    #[allow(clippy::too_many_arguments)]
    async fn report_waiting(
        &self,
        machine_id: &str,
        order: &Order,
        p: &mut Progress,
        reason: WaitReason,
        phase: WaitPhase,
        holders: &[Holder],
        closes_at: Option<u64>,
    ) {
        let mut pids: Vec<u32> = holders.iter().map(|holder| holder.pid).collect();
        pids.sort_unstable();
        let key = ReportKey {
            reason,
            phase,
            holders: pids,
            closes_at,
        };
        if p.last_report.as_ref() == Some(&key) {
            return;
        }
        p.last_report = Some(key);
        let waiting = Waiting {
            reason,
            phase,
            holders: holders
                .iter()
                .map(|holder| holder_info(holder, holder_user(holder)))
                .collect(),
            closes_at: closes_at.map(status::rfc3339),
        };
        self.status
            .report(self.event(machine_id, order, p, Report::Waiting(waiting)))
            .await;
    }

    async fn done(
        &self,
        machine_id: &str,
        order: &Order,
        p: &mut Progress,
        result: DoneResult,
        reboot_required: bool,
    ) -> Verdict {
        let relaunched = self.relaunch_closed(p).await;
        let done = Done {
            result,
            reboot_required,
            relaunched,
        };
        self.status
            .report(self.event(machine_id, order, p, Report::Done(done)))
            .await;
        Verdict::Finished
    }

    async fn fail(
        &self,
        machine_id: &str,
        order: &Order,
        p: &mut Progress,
        reason: FailReason,
        exit_code: Option<i64>,
        message: String,
    ) -> Verdict {
        warn!(request_id = %order.request_id, ?reason, %message, "Package update failed");
        self.relaunch_closed(p).await;
        let failed = Failed {
            reason,
            exit_code,
            message: Some(message),
        };
        self.status
            .report(self.event(machine_id, order, p, Report::Failed(failed)))
            .await;
        Verdict::Finished
    }

    /// Brings back what a forced close stopped, whatever the install came to.
    async fn relaunch_closed(&self, p: &mut Progress) -> bool {
        let closed = std::mem::take(&mut p.closed);
        if closed.is_empty() {
            return false;
        }
        let identity = p.prepared.as_ref().and_then(|prepared| prepared.identity());
        relaunch::relaunch(&closed, identity).await
    }

    /// A superseded order's forced close still gets its apps back.
    pub(super) async fn abandon(&self, request_id: &str, p: Progress) {
        if p.closed.is_empty() {
            return;
        }
        info!(
            request_id,
            "Relaunching the apps a superseded order had closed"
        );
        relaunch::relaunch(&p.closed, None).await;
    }

    fn event(
        &self,
        machine_id: &str,
        order: &Order,
        p: &Progress,
        report: Report,
    ) -> crate::models::PackageUpdateStatusMessage {
        let probe = p.probe.as_ref();
        status::build(
            machine_id,
            &order.request_id,
            &order.source,
            &order.package,
            probe.and_then(|probe| probe.installed.as_deref()),
            probe.and_then(|probe| probe.available.as_deref()),
            report,
        )
    }
}

fn holder_info(holder: &Holder, user: Option<String>) -> HolderInfo {
    let app = holder
        .image
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| holder.image.to_string_lossy().into_owned());
    HolderInfo { app, user }
}

#[cfg(target_os = "macos")]
fn holder_user(_holder: &Holder) -> Option<String> {
    crate::platform::user_session::get_console_user().map(|user| user.username)
}

#[cfg(target_os = "windows")]
fn holder_user(holder: &Holder) -> Option<String> {
    holder
        .session
        .and_then(crate::platform::user_session::session_user_name)
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn holder_user(_holder: &Holder) -> Option<String> {
    None
}

#[cfg(test)]
#[path = "run_tests.rs"]
mod tests;
