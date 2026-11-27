use super::*;

#[test]
fn each_key_kind_uses_its_own_header() {
    assert_eq!(LogStreamKey::Log("k1".into()).header(), ("x-log-key", "k1"));
    assert_eq!(
        LogStreamKey::Initial("k2".into()).header(),
        ("x-initial-key", "k2")
    );
}

#[test]
fn a_stored_log_key_wins_over_the_initial_key() {
    assert_eq!(
        choose_key(Some("log".into()), Some("enroll".into())),
        Some(LogStreamKey::Log("log".into()))
    );
    assert_eq!(
        choose_key(Some(String::new()), Some("enroll".into())),
        Some(LogStreamKey::Initial("enroll".into()))
    );
    assert_eq!(
        choose_key(None, Some("enroll".into())),
        Some(LogStreamKey::Initial("enroll".into()))
    );
    assert_eq!(choose_key(Some(String::new()), Some(String::new())), None);
    assert_eq!(choose_key(None, None), None);
}

#[tokio::test]
async fn a_401_on_the_websocket_handshake_reaches_the_event_callback_as_a_client_error() {
    let server = crate::test_support::mock_server_with_body(&[401], "").await;
    let (tx, mut rx) = mpsc::unbounded_channel();
    let _client = async_nats::ConnectOptions::new()
        .retry_on_initial_connect()
        .event_callback(move |event| {
            let tx = tx.clone();
            async move {
                if let async_nats::Event::ClientError(err) = event {
                    let _ = tx.send(err);
                }
            }
        })
        .connect(server.url.replace("http://", "ws://").as_str())
        .await
        .unwrap();

    tokio::time::timeout(Duration::from_secs(10), rx.recv())
        .await
        .expect("a client error within the deadline")
        .unwrap();
}

#[test]
fn tenant_domain_drops_the_api_prefix() {
    assert_eq!(
        extract_tenant_domain("api.acme.openframe.ai"),
        "acme.openframe.ai"
    );
    assert_eq!(
        extract_tenant_domain("acme.openframe.ai"),
        "acme.openframe.ai"
    );
}

fn home_with_chat_log(root: &Path, name: &str, with_log: bool) -> PathBuf {
    let home = root.join(name);
    let logs_dir = get_chat_logs_directory(&home);
    std::fs::create_dir_all(&logs_dir).unwrap();
    if with_log {
        std::fs::write(
            logs_dir.join("openframe-chat.log"),
            "[2026-11-25][01:00:00][INFO][app_lib] old\n",
        )
        .unwrap();
    }
    home
}

#[test]
fn each_home_with_a_chat_log_becomes_one_source_once() {
    let tmp = tempfile::TempDir::new().unwrap();
    let secured = tmp.path().join("secured");
    std::fs::create_dir(&secured).unwrap();
    let homes = [
        home_with_chat_log(tmp.path(), "alice", true),
        home_with_chat_log(tmp.path(), "bob", false),
        home_with_chat_log(tmp.path(), "carol", true),
    ];
    let mut known = HashSet::new();

    let sources = new_chat_sources(&mut known, &homes, &secured);

    assert_eq!(sources.len(), 2);
    assert!(sources.iter().all(|s| s.name() == "openframe-chat"));
    assert!(new_chat_sources(&mut known, &homes, &secured).is_empty());
}

#[test]
fn a_chat_log_created_later_is_picked_up_on_the_next_scan() {
    let tmp = tempfile::TempDir::new().unwrap();
    let homes = [home_with_chat_log(tmp.path(), "alice", false)];
    let mut known = HashSet::new();
    assert!(new_chat_sources(&mut known, &homes, tmp.path()).is_empty());

    std::fs::write(
        get_chat_logs_directory(&homes[0]).join("openframe-chat.log"),
        "",
    )
    .unwrap();

    assert_eq!(new_chat_sources(&mut known, &homes, tmp.path()).len(), 1);
}

#[test]
fn the_offset_file_name_is_the_fnv1a_hash_of_the_log_path() {
    assert_eq!(path_hash(Path::new("")), 0xcbf2_9ce4_8422_2325);
    assert_eq!(path_hash(Path::new("a")), 0xaf63_dc4c_8601_ec8c);
}
