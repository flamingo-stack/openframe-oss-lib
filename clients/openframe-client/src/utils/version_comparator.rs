use semver::Version;
use std::cmp::Ordering;

/// Parses a semver string, tolerating whitespace and a single `v`/`V` prefix.
pub fn parse_version(raw: &str) -> Option<Version> {
    let trimmed = raw.trim();
    let bare = trimmed
        .strip_prefix('v')
        .or_else(|| trimmed.strip_prefix('V'))
        .unwrap_or(trimmed);
    Version::parse(bare).ok()
}

/// Orders `to` against `from` by semver precedence (build metadata ignored): Less is a downgrade.
pub fn compare_versions(from: &str, to: &str) -> Option<Ordering> {
    let from = parse_version(from)?;
    let to = parse_version(to)?;
    Some(
        (to.major, to.minor, to.patch, &to.pre)
            .cmp(&(from.major, from.minor, from.patch, &from.pre)),
    )
}

#[cfg(test)]
#[path = "version_comparator_tests.rs"]
mod tests;
