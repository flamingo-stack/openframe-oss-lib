use super::{RestartOutcome, ToolRestartService};
use crate::platform::DirectoryManager;
use crate::services::{
    AgentConfigurationService, InitialConfigurationService, InstalledToolsService,
    ToolCommandParamsResolver, ToolKillService, ToolOps, ToolRunManager,
};
use tempfile::TempDir;

const TOOL: &str = "tool-a";

struct Fixture {
    _dir: TempDir,
    directory_manager: DirectoryManager,
    tool_ops: ToolOps,
    service: ToolRestartService,
}

fn fixture() -> Fixture {
    let dir = TempDir::new().unwrap();
    let root = dir.path();
    let directory_manager = DirectoryManager::with_custom_dirs(
        root.join("logs"),
        root.join("app_support"),
        root.join("secured"),
    );
    let installed_tools_service = InstalledToolsService::new(directory_manager.clone()).unwrap();
    let resolver = ToolCommandParamsResolver::new(
        directory_manager.clone(),
        InitialConfigurationService::new(directory_manager.clone()).unwrap(),
        AgentConfigurationService::new(directory_manager.clone()).unwrap(),
    );
    let tool_ops = ToolOps::default();
    let tool_run_manager = ToolRunManager::new(
        installed_tools_service.clone(),
        resolver,
        ToolKillService::new(),
        tool_ops.clone(),
    );
    let service = ToolRestartService::new(
        installed_tools_service,
        ToolKillService::new(),
        tool_run_manager,
        tool_ops.clone(),
    );
    Fixture {
        _dir: dir,
        directory_manager,
        tool_ops,
        service,
    }
}

#[tokio::test]
async fn busy_tool_is_not_restarted() {
    let f = fixture();
    let _op = f.tool_ops.lock(TOOL).await.mark_busy();

    let outcome = f.service.restart_guarded(TOOL).await.unwrap();

    assert!(matches!(outcome, RestartOutcome::Busy));
}

#[tokio::test]
async fn missing_record_releases_the_tool() {
    let f = fixture();

    let outcome = f.service.restart_guarded(TOOL).await.unwrap();

    assert!(matches!(outcome, RestartOutcome::NotInstalled));
    assert!(!f.tool_ops.is_busy(TOOL));
    assert!(f.tool_ops.is_released(TOOL));
}

#[tokio::test]
async fn failed_restart_releases_the_tool() {
    let f = fixture();
    std::fs::write(
        f.directory_manager
            .secured_dir()
            .join("installed_tools.json"),
        "not json",
    )
    .unwrap();

    let result = f.service.restart_guarded(TOOL).await;

    assert!(result.is_err());
    assert!(!f.tool_ops.is_busy(TOOL));
    assert!(f.tool_ops.try_lock(TOOL).is_ok());
}
