use std::collections::{BTreeMap, HashSet};

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::DeliveryRef;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Feature {
    DeliveryToolInstallation,
    DeliveryClientUninstall,
    DeliveryClientUpdate,
}

impl Feature {
    pub const ALL: [Feature; 3] = [
        Feature::DeliveryToolInstallation,
        Feature::DeliveryClientUninstall,
        Feature::DeliveryClientUpdate,
    ];

    pub fn name(self) -> &'static str {
        match self {
            Feature::DeliveryToolInstallation => "delivery-tool-installation",
            Feature::DeliveryClientUninstall => "delivery-client-uninstall",
            Feature::DeliveryClientUpdate => "delivery-client-update",
        }
    }

    pub fn default_enabled(self) -> bool {
        match self {
            Feature::DeliveryToolInstallation
            | Feature::DeliveryClientUninstall
            | Feature::DeliveryClientUpdate => false,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct FeatureFlagsMessage {
    pub flags: BTreeMap<String, Value>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct FeatureFlagsState {
    #[serde(default)]
    pub machine_id: String,
    pub sequence: i64,
    pub flags: BTreeMap<String, bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub awaiting_restart: Option<DeliveryRef>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct FeatureFlags {
    enabled: HashSet<Feature>,
}

impl FeatureFlags {
    pub fn from_flags(flags: &BTreeMap<String, bool>) -> Self {
        Self {
            enabled: Feature::ALL
                .into_iter()
                .filter(|feature| {
                    flags
                        .get(feature.name())
                        .copied()
                        .unwrap_or(feature.default_enabled())
                })
                .collect(),
        }
    }

    pub fn is_enabled(&self, feature: Feature) -> bool {
        self.enabled.contains(&feature)
    }
}
