use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(tag = "manager", rename_all = "UPPERCASE")]
pub enum PackageRef {
    Winget { id: String },
    Brew { kind: BrewKind, name: String },
    Choco { id: String },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum BrewKind {
    Formula,
    Cask,
}

impl PackageRef {
    /// Winget ids are case-insensitive; the rest compare as written.
    pub fn matches(&self, other: &PackageRef) -> bool {
        match (self, other) {
            (PackageRef::Winget { id: a }, PackageRef::Winget { id: b }) => {
                a.eq_ignore_ascii_case(b)
            }
            _ => self == other,
        }
    }
}

#[cfg(test)]
#[path = "package_ref_tests.rs"]
mod tests;
