use super::*;
use crate::platform::DirectoryManager;
use crate::services::{
    AgentConfigurationService, InitialConfigurationService, InstalledToolsService,
    ToolCommandParamsResolver, ToolKillService,
};
use tempfile::TempDir;
use tokio::time::timeout;

const BOUND: Duration = Duration::from_secs(10);

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

fn gate_with(tool_ops: ToolOps) -> (RestartGate, ToolRunManager, TempDir) {
    let dir = TempDir::new().unwrap();
    let directories = DirectoryManager::with_custom_dirs(
        dir.path().join("logs"),
        dir.path().join("app_support"),
        dir.path().join("secured"),
    );
    let tool_run_manager = ToolRunManager::new(
        InstalledToolsService::new(directories.clone()).unwrap(),
        ToolCommandParamsResolver::new(
            directories.clone(),
            InitialConfigurationService::new(directories.clone()).unwrap(),
            AgentConfigurationService::new(directories).unwrap(),
        ),
        ToolKillService::new(),
        tool_ops.clone(),
    );
    (
        RestartGate::new(tool_ops, tool_run_manager.clone()),
        tool_run_manager,
        dir,
    )
}

async fn until_requested(gate: &RestartGate) {
    timeout(BOUND, gate.requested())
        .await
        .expect("restart was never requested");
}

#[tokio::test]
async fn admits_concurrent_commands_while_no_restart_is_pending() {
    let (gate, _manager, _dir) = gate_with(ToolOps::default());

    let first = gate.admit();
    let second = gate.admit();

    assert!(first.is_some());
    assert!(second.is_some());
}

#[tokio::test]
async fn drain_refuses_new_commands_and_waits_for_the_admitted_one() {
    let (gate, _manager, _dir) = gate_with(ToolOps::default());
    let running = gate.admit().expect("admitted before the restart");

    let draining = start_drain(&gate);
    until_closed(&gate).await;
    assert!(!draining.is_finished());

    drop(running);
    until_requested(&gate).await;

    assert!(gate.admit().is_none());
}

#[tokio::test]
async fn drain_waits_for_a_busy_tool() {
    let tool_ops = ToolOps::default();
    let (gate, _manager, _dir) = gate_with(tool_ops.clone());
    let op = tool_ops.try_lock("fleetmdm-agent").unwrap().mark_busy();

    let draining = start_drain(&gate);
    until_closed(&gate).await;
    assert!(!draining.is_finished());

    drop(op);
    until_requested(&gate).await;
}

#[tokio::test]
async fn the_gate_stays_closed_after_the_restart_is_requested() {
    let (gate, _manager, _dir) = gate_with(ToolOps::default());

    start_drain(&gate);
    until_requested(&gate).await;

    assert!(gate.admit().is_none());
}

#[tokio::test]
async fn drain_waits_for_a_pending_client_update() {
    let (gate, tool_run_manager, _dir) = gate_with(ToolOps::default());
    tool_run_manager.mark_client_update_pending().await;

    let draining = start_drain(&gate);
    until_closed(&gate).await;
    assert!(!draining.is_finished());

    tool_run_manager.clear_client_update_pending().await;
    until_requested(&gate).await;
}
