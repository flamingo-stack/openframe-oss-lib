use anyhow::{Context, Result};
use std::path::Path;

pub fn bundle_id(bundle: &Path) -> Result<String> {
    info_string(bundle, "CFBundleIdentifier")
}

pub fn short_version(bundle: &Path) -> Result<String> {
    info_string(bundle, "CFBundleShortVersionString")
}

#[cfg(unix)]
pub fn owner_uid(bundle: &Path) -> Result<u32> {
    use std::os::unix::fs::MetadataExt;

    let metadata =
        std::fs::metadata(bundle).with_context(|| format!("cannot read {}", bundle.display()))?;
    Ok(metadata.uid())
}

fn info_string(bundle: &Path, key: &str) -> Result<String> {
    let info = bundle.join("Contents").join("Info.plist");
    let value = plist::Value::from_file(&info)
        .with_context(|| format!("cannot read {}", info.display()))?;
    value
        .as_dictionary()
        .and_then(|dict| dict.get(key))
        .and_then(plist::Value::as_string)
        .map(str::to_string)
        .with_context(|| format!("{} has no {key}", info.display()))
}

#[cfg(test)]
#[path = "app_bundle_tests.rs"]
mod tests;
