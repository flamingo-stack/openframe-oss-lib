use super::*;
use crate::clients::http_client_factory::{AGENT_VERSION_HEADER, BINARY_HASH_HEADER};
use crate::platform::binary_hash::{current_exe_sha256, sha256_file};
use crate::services::MACHINE_ID_HEADER;
use crate::test_support::{directories, mock_server};

fn credentials() -> PersistedMachineInfo {
    PersistedMachineInfo {
        machine_id: "server-machine-id".to_string(),
        client_secret: "secret".to_string(),
        user_id: None,
    }
}

#[tokio::test]
async fn uninstall_call_carries_the_identity_headers() {
    let server = mock_server(&[200]).await;
    let dir = tempfile::tempdir().unwrap();
    let dm = directories(&dir);
    let service = DeregistrationService::from_parts(
        server.url.clone(),
        DeregistrationService::http_client(&dm, false).unwrap(),
        Some(credentials()),
    )
    .unwrap();

    service.deregister_best_effort().await;

    let requests = server.requests();
    assert_eq!(requests.len(), 1);
    assert_eq!(
        requests[0].request_line,
        "POST /clients/api/agents/uninstall HTTP/1.1"
    );
    let head = requests[0].head.to_ascii_lowercase();
    let local_id = MachineIdService::new(&dm).get_or_create().unwrap();
    let hash = current_exe_sha256().unwrap();
    assert!(
        head.contains(&format!("{MACHINE_ID_HEADER}: server-machine-id")),
        "{head}"
    );
    assert!(!head.contains(local_id.trim()), "{head}");
    assert!(head.contains("x-client-secret: secret"), "{head}");
    assert!(
        head.contains(&format!(
            "{AGENT_VERSION_HEADER}: {}",
            env!("OPENFRAME_VERSION").to_ascii_lowercase()
        )),
        "{head}"
    );
    assert!(
        head.contains(&format!("{BINARY_HASH_HEADER}: {hash}")),
        "{head}"
    );
    assert!(service.reported.load(Ordering::Acquire));
}

#[tokio::test]
async fn other_calls_on_the_uninstall_client_send_the_local_machine_id() {
    let server = mock_server(&[200]).await;
    let dir = tempfile::tempdir().unwrap();
    let dm = directories(&dir);
    let client = DeregistrationService::http_client(&dm, false).unwrap();

    client
        .get(format!("{}/ping", server.url))
        .send()
        .await
        .unwrap();

    let head = server.requests()[0].head.to_ascii_lowercase();
    let local_id = MachineIdService::new(&dm).get_or_create().unwrap();
    assert!(!local_id.trim().is_empty());
    assert!(
        head.contains(&format!("{MACHINE_ID_HEADER}: {}", local_id.trim())),
        "{head}"
    );
    assert!(
        head.contains(&format!(
            "{BINARY_HASH_HEADER}: {}",
            sha256_file(&std::env::current_exe().unwrap()).unwrap()
        )),
        "{head}"
    );
}

#[test]
fn unreadable_machine_id_fails_construction_instead_of_sending_an_empty_header() {
    let dir = tempfile::tempdir().unwrap();
    let not_a_dir = dir.path().join("app");
    std::fs::write(&not_a_dir, b"a file where the app dir should be").unwrap();
    let dm = crate::platform::DirectoryManager::with_custom_dirs(
        dir.path().join("logs"),
        not_a_dir,
        dir.path().join("secured"),
    );

    let error = DeregistrationService::http_client(&dm, false).unwrap_err();
    assert!(error.to_string().contains("machine ID"), "{error:#}");
}
