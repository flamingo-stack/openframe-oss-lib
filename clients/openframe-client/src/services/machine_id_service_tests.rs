use super::*;

fn build(machine_id: Option<&str>) -> reqwest::Request {
    let client = reqwest::Client::new();
    with_machine_id(client.get("https://example.invalid/"), machine_id)
        .build()
        .unwrap()
}

#[test]
fn with_machine_id_sets_header() {
    let request = build(Some("local-machine-id"));
    assert_eq!(
        request.headers().get(MACHINE_ID_HEADER).unwrap(),
        "local-machine-id"
    );
}

#[test]
fn with_machine_id_none_leaves_request_untouched() {
    let request = build(None);
    assert!(request.headers().get(MACHINE_ID_HEADER).is_none());
}
