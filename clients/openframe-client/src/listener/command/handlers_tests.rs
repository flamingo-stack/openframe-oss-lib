use super::*;
use crate::listener::command::jetstream::consumer_config;

const MACHINE: &str = "abc123";

fn jetstream<H: CommandHandler>() -> JetStreamConsumer {
    match H::TRANSPORT {
        Transport::JetStream(consumer) => consumer,
        Transport::Core { .. } => panic!("{} is expected on JetStream", H::KIND),
    }
}

fn retired<H: CommandHandler>() -> RetiredConsumer {
    match H::TRANSPORT {
        Transport::Core { retired } => retired,
        Transport::JetStream(_) => panic!("{} is expected on Core", H::KIND),
    }
}

fn assert_jetstream<H: CommandHandler>(
    stream: &str,
    filter_subject: &str,
    deliver_subject: &str,
    durable: &str,
    deliver_policy: DeliverPolicy,
    max_deliver: i64,
    park: bool,
) {
    let consumer = jetstream::<H>();
    let config = consumer_config::<H>(consumer, MACHINE);
    assert_eq!(consumer.stream, stream);
    assert_eq!(config.filter_subject, filter_subject);
    assert_eq!(config.deliver_subject, deliver_subject);
    assert_eq!(config.durable_name.as_deref(), Some(durable));
    assert_eq!(config.deliver_policy, deliver_policy);
    assert_eq!(config.max_deliver, max_deliver);
    assert_eq!(config.ack_wait.as_secs(), 120);
    assert_eq!(H::PARK_DURING_CLIENT_UPDATE, park);
}

#[test]
fn tool_uninstall_keeps_its_consumer() {
    assert_jetstream::<ToolUninstallHandler>(
        "TOOL_INSTALLATION",
        "machine.abc123.tool-uninstall",
        "machine.abc123.tool-uninstall.inbox",
        "machine_abc123_tool-uninstall_consumer",
        DeliverPolicy::All,
        20,
        true,
    );
}

#[test]
fn tool_restart_keeps_its_consumer() {
    assert_jetstream::<ToolRestartHandler>(
        "TOOL_INSTALLATION",
        "machine.abc123.tool-restart",
        "machine.abc123.tool-restart.inbox",
        "machine_abc123_tool-restart_consumer",
        DeliverPolicy::All,
        20,
        true,
    );
}

#[test]
fn tool_update_keeps_its_broadcast_consumer() {
    assert_jetstream::<ToolAgentUpdateHandler>(
        "TOOL_UPDATE",
        "machine.all.tool.*.update",
        "machine.abc123.tool.update.inbox",
        "machine_abc123_tool_update_consumer",
        DeliverPolicy::New,
        10,
        true,
    );
}

#[test]
fn client_update_keeps_its_broadcast_consumer() {
    assert_jetstream::<OpenFrameClientUpdateHandler>(
        "CLIENT_UPDATE",
        "machine.all.client-update",
        "machine.abc123.client-update.inbox",
        "machine_abc123_client-update_consumer_v2",
        DeliverPolicy::New,
        10,
        false,
    );
}

#[test]
fn tool_installation_moves_to_core_and_retires_its_consumer() {
    let retired = retired::<ToolInstallationHandler>();
    assert_eq!(
        ToolInstallationHandler::subject(MACHINE),
        "machine.abc123.tool-installation"
    );
    assert_eq!(retired.stream, "TOOL_INSTALLATION");
    assert_eq!(
        (retired.durable)(MACHINE),
        "machine_abc123_tool-installation_consumer"
    );
    const { assert!(ToolInstallationHandler::PARK_DURING_CLIENT_UPDATE) };
}

#[test]
fn client_uninstall_moves_to_core_and_retires_its_consumer() {
    let retired = retired::<ClientUninstallHandler>();
    assert_eq!(
        ClientUninstallHandler::subject(MACHINE),
        "machine.abc123.client-uninstall"
    );
    assert_eq!(retired.stream, "CLIENT_UNINSTALL");
    assert_eq!(
        (retired.durable)(MACHINE),
        "machine_abc123_client-uninstall_consumer"
    );
    const { assert!(!ClientUninstallHandler::PARK_DURING_CLIENT_UPDATE) };
}

#[test]
fn client_uninstall_accepts_legacy_and_delivery_payloads() {
    for payload in [
        r#"{"issuedAt":"2026-10-12T10:00:00Z"}"#,
        r#"{"delivery":{"type":"CLIENT_UNINSTALL","targetId":"m","dispatchId":"d"},"issuedAt":"2026-10-12T10:00:00Z"}"#,
    ] {
        assert!(serde_json::from_str::<IgnoredAny>(payload).is_ok());
    }
}
