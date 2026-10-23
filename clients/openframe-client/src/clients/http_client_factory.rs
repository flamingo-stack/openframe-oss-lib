use anyhow::{Context, Result};
use reqwest::header::{HeaderMap, HeaderValue};
use reqwest::Client;
use std::time::Duration;

use crate::services::MACHINE_ID_HEADER;

pub const AGENT_VERSION_HEADER: &str = "x-agent-version";
pub const BINARY_HASH_HEADER: &str = "x-binary-hash";

pub fn build_agent_http_client(
    machine_id: &str,
    binary_hash: Option<&str>,
    timeout: Duration,
    accept_invalid_certs: bool,
) -> Result<Client> {
    Ok(Client::builder()
        .timeout(timeout)
        .default_headers(agent_default_headers(machine_id, binary_hash)?)
        .danger_accept_invalid_certs(accept_invalid_certs)
        .no_proxy()
        // disable connection pooling to force fresh DNS lookup on each request
        .pool_max_idle_per_host(0)
        .build()?)
}

// Identity headers every agent request carries; the hash is skipped when startup could not compute it.
pub(crate) fn agent_default_headers(
    machine_id: &str,
    binary_hash: Option<&str>,
) -> Result<HeaderMap> {
    let mut headers = HeaderMap::new();
    headers.insert(
        MACHINE_ID_HEADER,
        HeaderValue::from_str(machine_id).context("Invalid machine ID for header")?,
    );
    headers.insert(
        AGENT_VERSION_HEADER,
        HeaderValue::from_str(env!("OPENFRAME_VERSION"))
            .context("Invalid agent version for header")?,
    );
    if let Some(hash) = binary_hash {
        headers.insert(
            BINARY_HASH_HEADER,
            HeaderValue::from_str(hash).context("Invalid binary hash for header")?,
        );
    }
    Ok(headers)
}

#[cfg(test)]
#[path = "http_client_factory_tests.rs"]
mod tests;
