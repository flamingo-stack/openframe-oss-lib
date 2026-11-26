use serde_json::Value;
use tempfile::TempDir;

use super::*;
use crate::platform::os_updates::windows::fixtures::{installed, manageable, update};
use crate::platform::os_updates::windows::{Manageability, WindowsInventory};
use crate::services::os_updates::report::report;
use crate::test_support::{connection_manager, directories, registered_agent, NatsServer};

pub(in crate::services::os_updates) const STREAM: &str = "MACHINE_OS_UPDATES";
pub(in crate::services::os_updates) const SUBJECT: &str = "machine.machine.os-updates";

pub(in crate::services::os_updates) struct Backend {
    _server: NatsServer,
    _dir: TempDir,
    jetstream: async_nats::jetstream::Context,
    pub(in crate::services::os_updates) publisher: OsUpdatesReportPublisher,
}

impl Backend {
    pub(in crate::services::os_updates) async fn start() -> Option<Self> {
        let server = NatsServer::start()?;
        let dir = tempfile::tempdir().unwrap();
        let directories = directories(&dir);
        let config = registered_agent(&directories).await;
        let manager = connection_manager(server.url(), &directories, &config);
        manager.use_client_for_tests(async_nats::connect(server.url()).await.unwrap());
        let client = async_nats::connect(server.url()).await.unwrap();
        Some(Self {
            jetstream: async_nats::jetstream::new(client),
            publisher: OsUpdatesReportPublisher::new(NatsMessagePublisher::new(manager), config),
            _server: server,
            _dir: dir,
        })
    }

    pub(in crate::services::os_updates) async fn create_stream(&self) {
        self.jetstream
            .create_stream(async_nats::jetstream::stream::Config {
                name: STREAM.into(),
                subjects: vec!["machine.*.os-updates".into()],
                ..Default::default()
            })
            .await
            .unwrap();
    }

    pub(in crate::services::os_updates) async fn stored(&self, sequence: u64) -> Value {
        let message = self
            .jetstream
            .get_stream(STREAM)
            .await
            .unwrap()
            .get_raw_message(sequence)
            .await
            .unwrap();
        assert_eq!(message.subject.as_str(), SUBJECT);
        serde_json::from_slice(&message.payload).unwrap()
    }

    pub(in crate::services::os_updates) async fn stored_count(&self) -> u64 {
        self.jetstream
            .get_stream(STREAM)
            .await
            .unwrap()
            .info()
            .await
            .unwrap()
            .state
            .messages
    }
}

fn message(inventory: &WindowsInventory) -> MachineOsUpdatesMessage {
    report(inventory, &Manageability::Manageable)
}

#[tokio::test]
async fn the_report_is_stored_on_the_subject_of_the_machine() {
    let Some(backend) = Backend::start().await else {
        return;
    };
    backend.create_stream().await;

    backend
        .publisher
        .publish(message(&manageable()))
        .await
        .unwrap();

    let stored = backend.stored(1).await;
    assert_eq!(
        stored,
        serde_json::to_value(message(&manageable())).unwrap()
    );
}

#[tokio::test]
async fn a_report_no_stream_takes_is_a_failure() {
    let Some(backend) = Backend::start().await else {
        return;
    };

    let result = backend.publisher.publish(message(&manageable())).await;

    assert!(result.is_err());
}

#[tokio::test]
async fn a_report_over_the_payload_limit_goes_without_its_update_list() {
    let Some(backend) = Backend::start().await else {
        return;
    };
    backend.create_stream().await;
    let mut inventory = manageable();
    let mut heavy = update();
    heavy.cve_ids = (0..1000).map(|n| format!("CVE-2026-{n}")).collect();
    inventory.applicable.as_mut().unwrap().updates = vec![heavy; 100];
    inventory.history.as_mut().unwrap().entries = vec![installed()];

    backend
        .publisher
        .publish(message(&inventory))
        .await
        .unwrap();

    let stored = backend.stored(1).await;
    assert_eq!(
        stored["updates"],
        serde_json::json!({ "confidence": "TOO_LARGE", "items": null })
    );
    assert_eq!(stored["patchState"], "UPDATES_AVAILABLE");
    assert_eq!(stored["windows"]["history"].as_array().unwrap().len(), 1);
}

#[tokio::test]
async fn without_a_nats_connection_publishing_fails_at_once() {
    let dir = tempfile::tempdir().unwrap();
    let directories = directories(&dir);
    let config = registered_agent(&directories).await;
    let manager = connection_manager("nats://127.0.0.1:9".into(), &directories, &config);
    let publisher = OsUpdatesReportPublisher::new(NatsMessagePublisher::new(manager), config);

    assert!(publisher.publish(message(&manageable())).await.is_err());
}

#[test]
fn the_subject_suffix_is_stable() {
    assert_eq!(OS_UPDATES_SUBJECT, "os-updates");
}
