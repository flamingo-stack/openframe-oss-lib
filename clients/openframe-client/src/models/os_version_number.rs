use std::cmp::Ordering;
use std::fmt;
use std::str::FromStr;

use anyhow::{bail, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(try_from = "String", into = "String")]
pub struct OsVersionNumber {
    text: String,
    parts: Vec<u32>,
}

impl FromStr for OsVersionNumber {
    type Err = anyhow::Error;

    fn from_str(text: &str) -> Result<Self> {
        let text = text.trim();
        let mut parts = Vec::new();
        for part in text.split('.') {
            if part.is_empty() || !part.bytes().all(|b| b.is_ascii_digit()) {
                bail!("not a dotted OS version: {text:?}");
            }
            parts.push(part.parse()?);
        }
        while parts.len() > 1 && parts.last() == Some(&0) {
            parts.pop();
        }
        Ok(Self {
            text: text.to_string(),
            parts,
        })
    }
}

impl TryFrom<String> for OsVersionNumber {
    type Error = anyhow::Error;

    fn try_from(text: String) -> Result<Self> {
        text.parse()
    }
}

impl From<OsVersionNumber> for String {
    fn from(version: OsVersionNumber) -> Self {
        version.text
    }
}

impl fmt::Display for OsVersionNumber {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.text)
    }
}

impl PartialEq for OsVersionNumber {
    fn eq(&self, other: &Self) -> bool {
        self.parts == other.parts
    }
}

impl Eq for OsVersionNumber {}

impl PartialOrd for OsVersionNumber {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for OsVersionNumber {
    fn cmp(&self, other: &Self) -> Ordering {
        self.parts.cmp(&other.parts)
    }
}

#[cfg(test)]
#[path = "os_version_number_tests.rs"]
mod tests;
