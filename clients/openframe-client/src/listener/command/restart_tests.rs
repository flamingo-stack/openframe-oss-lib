use super::*;
use crate::config::update_config::SELF_RESTART_IDLE_WAIT_SECS;
use crate::services::execution_service::ExecutionService;
use crate::services::tool_ops::ToolOps;
use crate::services::tool_run_manager::ClientUpdatePendingFlag;
use tokio::time::timeout;

const BOUND: Duration = Duration::from_secs(10);

#[derive(Default)]
struct Work {
    tool_ops: ToolOps,
    scripts: ExecutionService,
    client_update: ClientUpdatePendingFlag,
}

impl Work {
    fn gate(&self) -> RestartGate {
        RestartGate::new(
            self.tool_ops.busy_tools(),
            self.scripts.running_scripts(),
            self.client_update.view(),
        )
    }
}

async fn until_closed(gate: &RestartGate) {
    timeout(BOUND, async {
        while gate.admit().is_some() {
            tokio::task::yield_now().await;
        }
    })
    .await
    .expect("the gate never closed");
}

fn start_drain(gate: &RestartGate) -> tokio::task::JoinHandle<()> {
    let gate = gate.clone();
    tokio::spawn(async move { gate.drain_and_request().await })
}

async fn until_requested(gate: &RestartGate) {
    timeout(BOUND, gate.requested())
        .await
        .expect("restart was never requested");
}

async fn drain_waits_until_released(gate: &RestartGate, release: impl FnOnce()) {
    let draining = start_drain(gate);
    until_closed(gate).await;
    assert!(!draining.is_finished());

    release();
    until_requested(gate).await;
}

#[tokio::test]
async fn admits_concurrent_commands_while_no_restart_is_pending() {
    let gate = Work::default().gate();

    let first = gate.admit();
    let second = gate.admit();

    assert!(first.is_some());
    assert!(second.is_some());
}

#[tokio::test]
async fn drain_refuses_new_commands_and_waits_for_the_admitted_one() {
    let gate = Work::default().gate();
    let running = gate.admit().expect("admitted before the restart");

    drain_waits_until_released(&gate, || drop(running)).await;

    assert!(gate.admit().is_none());
}

#[tokio::test]
async fn drain_waits_for_a_busy_tool() {
    let work = Work::default();
    let gate = work.gate();
    let op = work
        .tool_ops
        .try_lock("fleetmdm-agent")
        .unwrap()
        .mark_busy();

    drain_waits_until_released(&gate, || drop(op)).await;
}

#[tokio::test]
async fn drain_waits_for_a_running_script() {
    let work = Work::default();
    let gate = work.gate();
    let script = work.scripts.running_for_tests();

    drain_waits_until_released(&gate, || drop(script)).await;
}

#[tokio::test]
async fn drain_waits_for_a_pending_client_update() {
    let work = Work::default();
    let gate = work.gate();
    work.client_update.mark();

    drain_waits_until_released(&gate, || work.client_update.clear()).await;
}

#[tokio::test]
async fn the_gate_stays_closed_after_the_restart_is_requested() {
    let gate = Work::default().gate();

    start_drain(&gate);
    until_requested(&gate).await;

    assert!(gate.admit().is_none());
}

#[tokio::test(start_paused = true)]
async fn a_running_client_update_holds_the_restart_past_the_deadline() {
    let work = Work::default();
    let gate = work.gate();
    work.client_update.mark();

    let draining = start_drain(&gate);
    sleep(Duration::from_secs(SELF_RESTART_IDLE_WAIT_SECS * 2)).await;
    assert!(!draining.is_finished());

    work.client_update.clear();
    until_requested(&gate).await;
}

#[tokio::test(start_paused = true)]
async fn a_client_update_deferred_by_a_busy_tool_does_not_hold_the_restart() {
    let work = Work::default();
    let gate = work.gate();
    work.client_update.mark();
    let _op = work
        .tool_ops
        .try_lock("fleetmdm-agent")
        .unwrap()
        .mark_busy();

    let draining = start_drain(&gate);
    timeout(
        Duration::from_secs(SELF_RESTART_IDLE_WAIT_SECS * 2),
        gate.requested(),
    )
    .await
    .expect("restart was never requested");

    assert!(work.client_update.view().is_pending());
    draining.await.unwrap();
}
