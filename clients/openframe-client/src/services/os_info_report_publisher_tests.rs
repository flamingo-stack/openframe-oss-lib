use futures::StreamExt;
use tempfile::TempDir;
use tokio::time::{timeout, Duration};

use super::*;
use crate::platform::os_version;
use crate::test_support::{connection_manager, directories, registered_agent, NatsServer};

const BOUND: Duration = Duration::from_secs(10);

#[tokio::test]
async fn startup_report_carries_the_running_os_on_the_machine_subject() {
    let Some(server) = NatsServer::start() else {
        return;
    };
    let dir = TempDir::new().unwrap();
    let dm = directories(&dir);
    let config = registered_agent(&dm).await;
    let manager = connection_manager(server.url(), &dm, &config);
    manager.use_client_for_tests(async_nats::connect(server.url()).await.unwrap());

    let backend = async_nats::connect(server.url()).await.unwrap();
    let mut reports = backend.subscribe("machine.machine.os-info").await.unwrap();
    backend.flush().await.unwrap();

    OsInfoReportPublisher::new(NatsMessagePublisher::new(manager), config)
        .try_publish()
        .await
        .expect("the OS info report is published");

    let report = timeout(BOUND, reports.next())
        .await
        .expect("an OS info report on machine.machine.os-info")
        .expect("the subscription stays open");
    let body: serde_json::Value = serde_json::from_slice(&report.payload).unwrap();

    let os = os_version::current();
    let version = os.version.as_ref().expect("the running OS has a version");
    assert_eq!(body["osVersion"], version.to_string());
    assert_eq!(body["osBuild"], os.build.as_str());
}
