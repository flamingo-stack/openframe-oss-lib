use anyhow::{Context, Result};
use std::path::Path;

pub fn bundle_id(bundle: &Path) -> Result<String> {
    let info = bundle.join("Contents").join("Info.plist");
    let value = plist::Value::from_file(&info)
        .with_context(|| format!("cannot read {}", info.display()))?;
    value
        .as_dictionary()
        .and_then(|dict| dict.get("CFBundleIdentifier"))
        .and_then(plist::Value::as_string)
        .map(str::to_string)
        .with_context(|| format!("{} has no CFBundleIdentifier", info.display()))
}

#[cfg(test)]
#[path = "app_bundle_tests.rs"]
mod tests;
