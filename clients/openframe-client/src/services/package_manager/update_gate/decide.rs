use super::{AppIdentity, BlockReason, GateDecision, Holder, MainImages};
use crate::platform::process_snapshot::RunningProcess;
use std::path::Path;

/// A holder runs under the install dir, is no service, is a root instance, is a main image if known.
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
            MainImages::Derived(names) => {
                let image = p.image.to_string_lossy().to_lowercase();
                let name = image
                    .rsplit_once(['\\', '/'])
                    .map_or(&*image, |(_, name)| name);
                names.iter().any(|main| main.to_lowercase() == name)
            }
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
