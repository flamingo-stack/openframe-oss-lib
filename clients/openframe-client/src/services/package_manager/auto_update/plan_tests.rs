use super::*;
use crate::services::package_manager::update_gate::{BlockReason, Holder, Undetermined};
use std::path::PathBuf;

const SINCE: u64 = 1_000;
const FIVE_DAYS: u64 = 5 * 24 * 60 * 60;

fn running() -> GateDecision {
    GateDecision::Blocked(BlockReason::Running {
        holders: vec![Holder {
            pid: 1,
            image: PathBuf::from(r"C:\Program Files\App\app.exe"),
        }],
    })
}

fn undetermined() -> GateDecision {
    GateDecision::Blocked(BlockReason::Undetermined(Undetermined::NoInstallLocation))
}

fn force_after(seconds: Option<u64>) -> UpdatePolicy {
    UpdatePolicy {
        force_after_seconds: seconds,
    }
}

#[test]
fn the_decision_table() {
    let deadline = SINCE + FIVE_DAYS;
    let cases: &[(&str, GateDecision, Option<u64>, u64, Action)] = &[
        (
            "clear, safe",
            GateDecision::Clear,
            None,
            SINCE,
            Action::Upgrade,
        ),
        (
            "clear, forced policy",
            GateDecision::Clear,
            Some(FIVE_DAYS),
            SINCE,
            Action::Upgrade,
        ),
        (
            "running, safe",
            running(),
            None,
            deadline + 1,
            Action::Wait { force_at: None },
        ),
        (
            "running, before the deadline",
            running(),
            Some(FIVE_DAYS),
            deadline - 1,
            Action::Wait {
                force_at: Some(deadline),
            },
        ),
        (
            "running, at the deadline",
            running(),
            Some(FIVE_DAYS),
            deadline,
            Action::Force,
        ),
        (
            "undetermined, after the deadline",
            undetermined(),
            Some(FIVE_DAYS),
            deadline + 1,
            Action::Force,
        ),
        (
            "undetermined, safe",
            undetermined(),
            None,
            deadline + 1,
            Action::Wait { force_at: None },
        ),
        (
            "an immediate force policy",
            running(),
            Some(0),
            SINCE,
            Action::Force,
        ),
    ];

    for (name, gate, after, now, expected) in cases {
        assert_eq!(
            decide(gate, &force_after(*after), SINCE, *now),
            *expected,
            "{name}"
        );
    }
}
