use std::time::Duration;

use percent_encoding::{utf8_percent_encode, AsciiSet, NON_ALPHANUMERIC};

const WS_PATH: &str = "/ws/nats-api";

const FAST_RETRIES: usize = 3;
const FAST_DELAY_MS: u64 = 200;
const BASE_DELAY_MS: u64 = 1_000;
const MAX_DELAY_MS: u64 = 30_000;

const QUERY_VALUE: &AsciiSet = &NON_ALPHANUMERIC
    .remove(b'-')
    .remove(b'_')
    .remove(b'.')
    .remove(b'~');

pub fn build_connect_url(server_url: &str, token: &str) -> String {
    let (scheme, host) = match server_url.strip_prefix("http://") {
        Some(h) => ("ws", h),
        None => (
            "wss",
            server_url.strip_prefix("https://").unwrap_or(server_url),
        ),
    };
    let host = host.trim_end_matches('/');
    let token = utf8_percent_encode(token, QUERY_VALUE);
    format!("{scheme}://{host}{WS_PATH}?authorization={token}")
}

pub fn mask_token(token: &str) -> String {
    let n = token.chars().count();
    if n <= 8 {
        return "****".to_string();
    }
    let first: String = token.chars().take(4).collect();
    let last: String = token.chars().skip(n - 4).collect();
    format!("{first}...{last} (len {n})")
}

pub fn mask_connect_url(url: &str) -> String {
    match url.split_once("authorization=") {
        Some((base, token)) => format!("{base}authorization={}", mask_token(token)),
        None => url.to_string(),
    }
}

pub fn backoff_ms(exp: u32) -> u64 {
    BASE_DELAY_MS
        .saturating_mul(2u64.saturating_pow(exp.min(20)))
        .min(MAX_DELAY_MS)
}

pub fn reconnect_delay(attempt: usize) -> Duration {
    let base_ms = if attempt <= FAST_RETRIES {
        FAST_DELAY_MS
    } else {
        backoff_ms((attempt - FAST_RETRIES - 1) as u32)
    };
    let jitter = 0.5 + rand::random::<f64>() * 0.5;
    Duration::from_millis((base_ms as f64 * jitter) as u64)
}

#[cfg(test)]
#[path = "connect_tests.rs"]
mod tests;
