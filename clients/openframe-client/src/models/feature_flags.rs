use std::cmp::Ordering;
use std::collections::{BTreeMap, HashSet};

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::DeliveryRef;
use crate::config::update_config::DEV_CLIENT_VERSION;
use crate::utils::version_comparator::{parse_version, precedence};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Feature {
    DeliveryToolInstallation,
    DeliveryClientUninstall,
    DeliveryClientUpdate,
    PackageAutoUpdate,
}

impl Feature {
    pub const ALL: [Feature; 4] = [
        Feature::DeliveryToolInstallation,
        Feature::DeliveryClientUninstall,
        Feature::DeliveryClientUpdate,
        Feature::PackageAutoUpdate,
    ];

    pub fn name(self) -> &'static str {
        match self {
            Feature::DeliveryToolInstallation => "delivery-tool-installation",
            Feature::DeliveryClientUninstall => "delivery-client-uninstall",
            Feature::DeliveryClientUpdate => "delivery-client-update",
            Feature::PackageAutoUpdate => "package-auto-update",
        }
    }

    pub fn default_enabled(self) -> bool {
        match self {
            Feature::DeliveryToolInstallation
            | Feature::DeliveryClientUninstall
            | Feature::DeliveryClientUpdate
            | Feature::PackageAutoUpdate => false,
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
    pub flags: BTreeMap<String, FeatureFlag>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub awaiting_restart: Option<DeliveryRef>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeatureFlag {
    pub enabled: bool,
    pub min_version: String,
}

impl FeatureFlag {
    fn effective(&self, running_version: &str, default: bool) -> bool {
        if running_version == DEV_CLIENT_VERSION {
            return self.enabled;
        }
        match (
            parse_version(running_version),
            parse_version(&self.min_version),
        ) {
            (Some(running), Some(min)) if precedence(&running, &min) != Ordering::Less => {
                self.enabled
            }
            _ => default,
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct FeatureFlags {
    enabled: HashSet<Feature>,
}

impl FeatureFlags {
    pub fn resolve(flags: &BTreeMap<String, FeatureFlag>, running_version: &str) -> Self {
        Self {
            enabled: Feature::ALL
                .into_iter()
                .filter(|feature| match flags.get(feature.name()) {
                    Some(flag) => flag.effective(running_version, feature.default_enabled()),
                    None => feature.default_enabled(),
                })
                .collect(),
        }
    }

    pub fn is_enabled(&self, feature: Feature) -> bool {
        self.enabled.contains(&feature)
    }
}

#[cfg(test)]
#[path = "feature_flags_tests.rs"]
mod tests;
