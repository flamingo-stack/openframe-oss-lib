use anyhow::{Context, Result};
use reqwest::header::{HeaderMap, HeaderValue};
use reqwest::Client;
use std::time::Duration;

use crate::services::MACHINE_ID_HEADER;

pub fn build_agent_http_client(
    machine_id: &str,
    timeout: Duration,
    accept_invalid_certs: bool,
) -> Result<Client> {
    let mut headers = HeaderMap::new();
    headers.insert(
        MACHINE_ID_HEADER,
        HeaderValue::from_str(machine_id).context("Invalid machine ID for header")?,
    );

    Ok(Client::builder()
        .timeout(timeout)
        .default_headers(headers)
        .danger_accept_invalid_certs(accept_invalid_certs)
        .no_proxy()
        // disable connection pooling to force fresh DNS lookup on each request
        .pool_max_idle_per_host(0)
        .build()?)
}
