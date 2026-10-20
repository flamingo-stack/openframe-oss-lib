use std::sync::Arc;

use tracing::{info, warn};

use super::managers::{self, QueryError, UpgradeOutcome, UPGRADE_TIMEOUT_SECS};
use super::orders::Order;
use super::status::{self, Report};
use super::{close, relaunch, Worker};
use crate::models::{
    Done, DoneResult, FailReason, Failed, HolderInfo, UpdateMode, WaitPhase, WaitReason, Waiting,
};
use crate::services::package_manager::update_gate::{
    self, AppIdentity, BlockReason, GateDecision, Holder, Prepared,
};
use crate::services::package_manager::{is_supported, ManagerId, Presence};

/// How often a waiting order looks at the gate again.
pub(super) const POLL_SECS: u64 = 60;
/// How often a counting-down order looks for the app to quit on its own.
const COUNTDOWN_POLL_SECS: u64 = 10;
/// Retry spacing and budget while the manager is busy or a holder stays unseen.
const BUSY_RETRY_SECS: u64 = 5 * 60;
const BUSY_BUDGET_SECS: u64 = 60 * 60;
/// How long a manager's presence and outdated answer stay trusted.
const PROBE_TTL_SECS: u64 = 4 * 60 * 60;

/// What the worker remembers about one order between looks; gone after a restart by design,
/// so an interrupted countdown starts over in full.
#[derive(Default)]
pub(super) struct Progress {
    revision: Option<u64>,
    present_at: Option<u64>,
    probe: Option<Probe>,
    prepared: Option<Arc<Prepared>>,
    countdown: Option<u64>,
    busy_since: Option<u64>,
    unseen_since: Option<u64>,
    last_report: Option<ReportKey>,
    /// Unix seconds before which the order is not looked at again.
    pub(super) next_at: u64,
}

struct Probe {
    installed: Option<String>,
    available: Option<String>,
    at: u64,
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
        if p.revision != Some(order.revision) {
            p.revision = Some(order.revision);
            p.countdown = None;
            p.last_report = None;
        }
        let manager = ManagerId::of(&order.package);
        if !is_supported(manager) {
            return self
                .fail(
                    machine_id,
                    order,
                    p,
                    FailReason::NotSupported,
                    None,
                    format!("{manager:?} is not supported on this device"),
                )
                .await;
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
            match managers::outdated(manager).await {
                Ok(outdated) => {
                    let Some(found) = outdated.into_iter().find(|o| o.package == order.package)
                    else {
                        return self
                            .done(
                                machine_id,
                                order,
                                p,
                                DoneResult::AlreadyLatest,
                                false,
                                false,
                            )
                            .await;
                    };
                    p.probe = Some(Probe {
                        installed: found.installed_version,
                        available: found.available_version,
                        at: now,
                    });
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
                let prepared =
                    Arc::new(update_gate::prepare(std::slice::from_ref(&order.package)).await);
                p.prepared = Some(prepared.clone());
                prepared
            }
        };
        let identity = prepared.identity(&order.package);
        match prepared.check_now(&order.package).await {
            GateDecision::Clear => self.install(machine_id, order, p, now, &[], identity).await,
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
                UpdateMode::Force => {
                    self.countdown(machine_id, order, p, now, holders, identity)
                        .await
                }
            },
            GateDecision::Blocked(BlockReason::Undetermined(reason)) => {
                info!(
                    request_id = %order.request_id,
                    %reason,
                    "Cannot tell whether the app is running, letting the package manager decide"
                );
                self.install(machine_id, order, p, now, &[], identity).await
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
        identity: Option<&AppIdentity>,
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
        let pids: Vec<u32> = holders.iter().map(|holder| holder.pid).collect();
        let survivors = close::close(&pids).await;
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
        self.install(machine_id, order, p, now, &holders, identity)
            .await
    }

    async fn install(
        &self,
        machine_id: &str,
        order: &Order,
        p: &mut Progress,
        now: u64,
        closed: &[Holder],
        identity: Option<&AppIdentity>,
    ) -> Verdict {
        let outcome = {
            let _running = self.package_upgrades.begin();
            managers::upgrade(&order.package).await
        };
        info!(request_id = %order.request_id, ?outcome, "Package update attempt finished");
        match outcome {
            UpgradeOutcome::Upgraded { reboot_required } => {
                let relaunched = !closed.is_empty() && relaunch::relaunch(closed, identity).await;
                self.done(
                    machine_id,
                    order,
                    p,
                    DoneResult::Upgraded,
                    reboot_required,
                    relaunched,
                )
                .await
            }
            UpgradeOutcome::AlreadyLatest => {
                let relaunched = !closed.is_empty() && relaunch::relaunch(closed, identity).await;
                self.done(
                    machine_id,
                    order,
                    p,
                    DoneResult::AlreadyLatest,
                    false,
                    relaunched,
                )
                .await
            }
            UpgradeOutcome::InUse(reason) if !closed.is_empty() => {
                self.fail(machine_id, order, p, FailReason::CloseFailed, None, reason)
                    .await
            }
            UpgradeOutcome::InUse(reason) => {
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
        }
    }

    async fn busy(
        &self,
        machine_id: &str,
        order: &Order,
        p: &mut Progress,
        now: u64,
        reason: &str,
    ) -> Verdict {
        let since = *p.busy_since.get_or_insert(now);
        if now >= since + BUSY_BUDGET_SECS {
            return self
                .fail(
                    machine_id,
                    order,
                    p,
                    FailReason::Timeout,
                    None,
                    format!("the package manager stayed busy for over an hour: {reason}"),
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
            holders: holders.iter().map(holder_info).collect(),
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
        relaunched: bool,
    ) -> Verdict {
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
            order,
            probe.and_then(|probe| probe.installed.as_deref()),
            probe.and_then(|probe| probe.available.as_deref()),
            report,
        )
    }
}

fn holder_info(holder: &Holder) -> HolderInfo {
    let app = holder
        .image
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| holder.image.to_string_lossy().into_owned());
    HolderInfo {
        app,
        user: console_user_name(),
    }
}

#[cfg(target_os = "macos")]
fn console_user_name() -> Option<String> {
    crate::platform::user_session::get_console_user().map(|user| user.username)
}

#[cfg(not(target_os = "macos"))]
fn console_user_name() -> Option<String> {
    None
}
