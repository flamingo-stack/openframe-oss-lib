use super::{ToolUninstallService, UninstallOutcome};
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
    tool_run_manager: ToolRunManager,
    service: ToolUninstallService,
}

async fn supervised_tool() -> Fixture {
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
        resolver.clone(),
        ToolKillService::new(),
        tool_ops.clone(),
    );
    tool_run_manager.supervise_for_test(TOOL).await;
    let service = ToolUninstallService::new(
        installed_tools_service,
        resolver,
        ToolKillService::new(),
        directory_manager.clone(),
    );
    Fixture {
        _dir: dir,
        directory_manager,
        tool_ops,
        tool_run_manager,
        service,
    }
}

#[tokio::test]
async fn busy_tool_is_deferred_and_stays_supervised() {
    let f = supervised_tool().await;
    let _op = f.tool_ops.lock(TOOL).await.mark_busy();

    let outcome = f
        .service
        .uninstall_guarded(TOOL, &f.tool_ops, &f.tool_run_manager)
        .await
        .unwrap();

    assert!(matches!(outcome, UninstallOutcome::Busy));
    assert!(f.tool_run_manager.is_supervised(TOOL).await);
}

#[tokio::test]
async fn missing_record_drops_supervision_and_releases_the_tool() {
    let f = supervised_tool().await;

    let outcome = f
        .service
        .uninstall_guarded(TOOL, &f.tool_ops, &f.tool_run_manager)
        .await
        .unwrap();

    assert!(matches!(outcome, UninstallOutcome::NotInstalled));
    assert!(!f.tool_run_manager.is_supervised(TOOL).await);
    assert!(!f.tool_ops.is_busy(TOOL));
    assert!(f.tool_ops.is_released(TOOL));
}

#[tokio::test]
async fn failed_uninstall_keeps_supervision_and_releases_the_tool() {
    let f = supervised_tool().await;
    std::fs::write(
        f.directory_manager
            .secured_dir()
            .join("installed_tools.json"),
        "not json",
    )
    .unwrap();

    let result = f
        .service
        .uninstall_guarded(TOOL, &f.tool_ops, &f.tool_run_manager)
        .await;

    assert!(result.is_err());
    assert!(f.tool_run_manager.is_supervised(TOOL).await);
    assert!(!f.tool_ops.is_busy(TOOL));
    assert!(f.tool_ops.try_lock(TOOL).is_ok());
}
