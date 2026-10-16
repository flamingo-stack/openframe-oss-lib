use super::{AppIdentity, BlockReason, GateDecision, Holder, MainImages};
use crate::platform::process_snapshot::RunningProcess;
use std::path::Path;

/// A process holds the package when it runs from under the install dir, is not a service,
/// is a root instance (its parent runs another image), and — when main images are known —
/// is one of them. Pure: no OS access.
pub fn decide(identity: &AppIdentity, processes: &[RunningProcess]) -> GateDecision {
    let AppIdentity::App {
        install_dir,
        main_images,
    } = identity
    else {
        return GateDecision::Clear;
    };

    let holders: Vec<Holder> = processes
        .iter()
        .filter(|p| is_under(&p.image, install_dir) && !p.is_service)
        .filter(|p| {
            p.parent_image.as_deref().is_none_or(|parent| {
                !parent
                    .to_string_lossy()
                    .eq_ignore_ascii_case(&p.image.to_string_lossy())
            })
        })
        .filter(|p| match main_images {
            MainImages::Derived(names) => p.image.file_name().is_some_and(|name| {
                let name = name.to_string_lossy().to_lowercase();
                names.iter().any(|main| main.to_lowercase() == name)
            }),
            MainImages::Unknown => true,
        })
        .map(|p| Holder {
            pid: p.pid,
            image: p.image.clone(),
        })
        .collect();

    if holders.is_empty() {
        GateDecision::Clear
    } else {
        GateDecision::Blocked(BlockReason::Running { holders })
    }
}

/// Case-insensitive "`path` lies strictly below `dir`", for both separators.
pub(super) fn is_under(path: &Path, dir: &Path) -> bool {
    let path = path.to_string_lossy().to_lowercase();
    let dir = dir.to_string_lossy().to_lowercase();
    let dir = dir.trim_end_matches(['\\', '/']);
    !dir.is_empty()
        && path
            .strip_prefix(dir)
            .is_some_and(|rest| rest.len() > 1 && rest.starts_with(['\\', '/']))
}

#[cfg(test)]
#[path = "decide_tests.rs"]
mod tests;
