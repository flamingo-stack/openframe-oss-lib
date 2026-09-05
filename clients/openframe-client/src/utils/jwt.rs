use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use serde::Deserialize;

/// `iat`/`exp` of a JWT in seconds since the Unix epoch, read without verifying the signature.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
pub struct JwtTimes {
    pub exp: i64,
    #[serde(default)]
    pub iat: Option<i64>,
}

impl JwtTimes {
    /// Lifetime the issuer granted (`exp - iat`); `None` without `iat` or when it isn't positive.
    pub fn ttl_secs(&self) -> Option<i64> {
        self.iat.map(|iat| self.exp - iat).filter(|ttl| *ttl > 0)
    }
}

/// Decode a JWT's time claims without verifying the signature; `None` if malformed or without `exp`.
pub fn token_times_unix(token: &str) -> Option<JwtTimes> {
    // Require a well-formed `header.payload.signature` — reject tokens with missing or extra parts.
    let mut parts = token.split('.');
    let (Some(_header), Some(payload), Some(_signature), None) =
        (parts.next(), parts.next(), parts.next(), parts.next())
    else {
        return None;
    };
    let bytes = URL_SAFE_NO_PAD.decode(payload.trim_end_matches('=')).ok()?;
    serde_json::from_slice(&bytes).ok()
}

#[cfg(test)]
#[path = "jwt_tests.rs"]
mod tests;
