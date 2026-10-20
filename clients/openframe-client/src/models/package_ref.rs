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
