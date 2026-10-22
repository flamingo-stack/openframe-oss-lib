use anyhow::{ensure, Context, Result};
use reqwest::header::{HeaderMap, HeaderValue};
use reqwest::Client;
use std::time::Duration;
use tracing::warn;

use crate::services::MACHINE_ID_HEADER;

pub const AGENT_VERSION_HEADER: &str = "x-agent-version";
pub const BINARY_HASH_HEADER: &str = "x-binary-hash";

pub fn build_agent_http_client(
    machine_id: &str,
    binary_hash: Option<&str>,
    timeout: Duration,
    accept_invalid_certs: bool,
) -> Result<Client> {
    let headers = identity_headers(machine_id, env!("OPENFRAME_VERSION"), binary_hash)?;

    Ok(Client::builder()
        .timeout(timeout)
        .default_headers(headers)
        .danger_accept_invalid_certs(accept_invalid_certs)
        .no_proxy()
        // disable connection pooling to force fresh DNS lookup on each request
        .pool_max_idle_per_host(0)
        .build()?)
}

/// Default headers naming this agent: the machine id is mandatory, the other two are dropped when invalid.
pub(crate) fn identity_headers(
    machine_id: &str,
    agent_version: &str,
    binary_hash: Option<&str>,
) -> Result<HeaderMap> {
    ensure!(!machine_id.trim().is_empty(), "Machine ID is empty");

    let mut headers = HeaderMap::new();
    headers.insert(
        MACHINE_ID_HEADER,
        HeaderValue::from_str(machine_id).context("Invalid machine ID for header")?,
    );
    insert_if_valid(&mut headers, AGENT_VERSION_HEADER, agent_version);
    if let Some(binary_hash) = binary_hash {
        insert_if_valid(&mut headers, BINARY_HASH_HEADER, binary_hash);
    }
    Ok(headers)
}

fn insert_if_valid(headers: &mut HeaderMap, name: &'static str, value: &str) {
    match HeaderValue::from_str(value) {
        Ok(value) => {
            headers.insert(name, value);
        }
        Err(e) => warn!(
            "Dropping the {} header, invalid value {:?}: {}",
            name, value, e
        ),
    }
}

#[cfg(test)]
#[path = "http_client_factory_tests.rs"]
mod tests;
