use super::*;
use crate::models::InitialConfiguration;
use crate::test_support::{directories, mock_server_with_body};

#[tokio::test]
async fn an_empty_initial_key_is_refused_before_any_request() {
    let server = mock_server_with_body(&[200], "{}").await;
    let dir = tempfile::tempdir().unwrap();
    let dm = directories(&dir);
    let initial = InitialConfigurationService::new(dm.clone()).unwrap();
    initial
        .save(&InitialConfiguration {
            server_host: "acme.openframe.ai".into(),
            initial_key: String::new(),
            log_key: "log".into(),
            ..Default::default()
        })
        .unwrap();
    let service = AgentRegistrationService::new(
        RegistrationClient::new(server.url.clone(), reqwest::Client::new()).unwrap(),
        DeviceDataFetcher::new(),
        AgentConfigurationService::new(dm).unwrap(),
        initial,
    );

    let err = service.register_agent().await.unwrap_err();

    assert!(err.to_string().contains("fresh install command"));
    assert!(server.requests().is_empty());
}
