use super::*;
use std::sync::Mutex;

#[derive(Default)]
struct RecordingUpdater {
    calls: Mutex<Vec<&'static str>>,
    fail_fetch: bool,
    fail_apply: bool,
}

impl RecordingUpdater {
    fn record(&self, call: &'static str) {
        self.calls.lock().unwrap().push(call);
    }

    fn calls(&self) -> Vec<&'static str> {
        self.calls.lock().unwrap().clone()
    }
}

#[async_trait]
impl ToolUpdater for RecordingUpdater {
    async fn fetch(
        &self,
        _tool: &InstalledTool,
        _config: &DownloadConfiguration,
    ) -> Result<Staged> {
        self.record("fetch");
        if self.fail_fetch {
            anyhow::bail!("network down");
        }
        Ok(Staged::Binary(Bytes::from_static(b"new")))
    }

    async fn prepare(&self, _tool: &InstalledTool) -> Result<UpdateContext> {
        self.record("prepare");
        Ok(UpdateContext::default())
    }

    async fn apply(
        &self,
        _tool: &InstalledTool,
        _config: &DownloadConfiguration,
        _staged: &Staged,
    ) -> Result<Option<Installation>> {
        self.record("apply");
        if self.fail_apply {
            anyhow::bail!("disk full");
        }
        Ok(None)
    }

    async fn finalize(&self, _tool: &InstalledTool, _ctx: &UpdateContext) -> Result<()> {
        self.record("finalize");
        Ok(())
    }

    async fn rollback(&self, _tool: &InstalledTool, _ctx: &UpdateContext) -> Result<()> {
        self.record("rollback");
        Ok(())
    }
}

fn config() -> DownloadConfiguration {
    DownloadConfiguration {
        os: "any".to_string(),
        file_name: "agent.tar.gz".to_string(),
        target_file_name: "agent".to_string(),
        link: "https://example.invalid/agent.tar.gz".to_string(),
        installation_type: InstallationType::Standard,
        bundle_id: None,
        service_name: None,
    }
}

async fn run(updater: &RecordingUpdater) -> Result<Option<Installation>> {
    let tool = InstalledTool {
        tool_agent_id: "tool".to_string(),
        ..Default::default()
    };
    run_updater(updater, &tool, &config()).await
}

#[tokio::test]
async fn failed_download_never_stops_the_tool() {
    let updater = RecordingUpdater {
        fail_fetch: true,
        ..Default::default()
    };

    let err = run(&updater).await.unwrap_err();

    assert_eq!(updater.calls(), ["fetch"]);
    assert!(format!("{err:#}").contains("the running tool was not touched"));
}

#[tokio::test]
async fn failed_apply_rolls_back_after_the_stop() {
    let updater = RecordingUpdater {
        fail_apply: true,
        ..Default::default()
    };

    run(&updater).await.unwrap_err();

    assert_eq!(updater.calls(), ["fetch", "prepare", "apply", "rollback"]);
}

#[tokio::test]
async fn update_downloads_before_it_stops_the_tool() {
    let updater = RecordingUpdater::default();

    run(&updater).await.unwrap();

    assert_eq!(updater.calls(), ["fetch", "prepare", "apply", "finalize"]);
}

#[cfg(target_os = "macos")]
#[tokio::test]
async fn staged_tree_replaces_target_entries_and_removes_itself() {
    let target = tempfile::tempdir().unwrap();
    let staging = StagingDir::new(target.path(), "tool");
    std::fs::create_dir_all(staging.root.join("App.app/Contents")).unwrap();
    std::fs::write(staging.root.join("App.app/Contents/new"), b"new").unwrap();
    std::fs::write(staging.root.join("readme"), b"new").unwrap();
    std::fs::create_dir_all(target.path().join("App.app/Contents")).unwrap();
    std::fs::write(target.path().join("App.app/Contents/old"), b"old").unwrap();
    std::fs::write(target.path().join("readme"), b"old").unwrap();

    staging.move_into().await.unwrap();

    assert!(target.path().join("App.app/Contents/new").exists());
    assert!(!target.path().join("App.app/Contents/old").exists());
    assert_eq!(std::fs::read(target.path().join("readme")).unwrap(), b"new");
    assert!(!staging.root.exists());
}

#[cfg(target_os = "macos")]
#[tokio::test]
async fn removing_update_staging_is_idempotent() {
    let target = tempfile::tempdir().unwrap();
    let staging = target.path().join(".tool.update-staging");
    std::fs::create_dir_all(staging.join("App.app")).unwrap();

    let staging_dir = StagingDir::new(target.path(), "tool");
    staging_dir.discard("tool").await;
    staging_dir.discard("tool").await;

    assert!(!staging.exists());
}
