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

/// Semver precedence: build metadata carries no order, unlike the crate's `Ord`.
pub fn precedence(a: &Version, b: &Version) -> Ordering {
    (a.major, a.minor, a.patch, &a.pre).cmp(&(b.major, b.minor, b.patch, &b.pre))
}

/// Orders `to` against `from` by precedence: Less is a downgrade.
pub fn compare_versions(from: &str, to: &str) -> Option<Ordering> {
    Some(precedence(&parse_version(to)?, &parse_version(from)?))
}

#[cfg(test)]
#[path = "version_comparator_tests.rs"]
mod tests;
