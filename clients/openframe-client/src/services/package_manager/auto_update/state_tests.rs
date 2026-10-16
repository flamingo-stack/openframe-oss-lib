use super::*;
use crate::models::{BrewKind, UpdatePolicy};

const HOUR: u64 = 60 * 60;
const DAY: u64 = 24 * HOUR;
const T0: u64 = 1_800_000_000;

fn winget(id: &str) -> PackageRef {
    PackageRef::Winget { id: id.to_string() }
}

fn cask(name: &str) -> PackageRef {
    PackageRef::Brew {
        kind: BrewKind::Cask,
        name: name.to_string(),
    }
}

fn is_winget(package: &PackageRef) -> bool {
    matches!(package, PackageRef::Winget { .. })
}

fn safe(package: PackageRef) -> PolicyEntry {
    PolicyEntry {
        package,
        policy: UpdatePolicy::default(),
    }
}

fn forced_after(package: PackageRef, seconds: u64) -> PolicyEntry {
    PolicyEntry {
        package,
        policy: UpdatePolicy {
            force_after_seconds: Some(seconds),
        },
    }
}

/// A policy covering every package these tests observe.
fn wide_policy() -> Vec<PolicyEntry> {
    [winget("A"), winget("B"), cask("postman")]
        .into_iter()
        .map(safe)
        .collect()
}

/// A state whose last pass completed at `at` for console logon `logon`.
fn passed_at(at: u64, logon: u64) -> UpdateState {
    let mut state = UpdateState::default();
    state.complete_pass(at, Some(logon), true);
    state
}

#[test]
fn a_new_package_starts_its_clock_and_keeps_it() {
    let mut state = UpdateState::default();

    state.observe(&wide_policy(), is_winget, &[winget("A")], T0);
    state.observe(&wide_policy(), is_winget, &[winget("A")], T0 + DAY);

    assert_eq!(state.outdated_since(&winget("A")), Some(T0));
}

#[test]
fn a_package_no_longer_outdated_is_forgotten_and_restarts_later() {
    let mut state = UpdateState::default();
    state.observe(&wide_policy(), is_winget, &[winget("A")], T0);

    state.observe(&wide_policy(), is_winget, &[], T0 + HOUR);
    assert_eq!(state.outdated_since(&winget("A")), None);

    state.observe(&wide_policy(), is_winget, &[winget("A")], T0 + DAY);
    assert_eq!(state.outdated_since(&winget("A")), Some(T0 + DAY));
}

#[test]
fn observing_one_manager_leaves_the_others_clocks_alone() {
    let mut state = UpdateState::default();
    state.observe(&wide_policy(), |p| !is_winget(p), &[cask("postman")], T0);

    state.observe(&wide_policy(), is_winget, &[], T0 + HOUR);

    assert_eq!(state.outdated_since(&cask("postman")), Some(T0));
}

#[test]
fn packages_dropped_from_the_policy_are_forgotten() {
    let mut state = UpdateState::default();
    state.observe(&wide_policy(), is_winget, &[winget("A"), winget("B")], T0);

    state.retain(&[safe(winget("B"))]);

    assert_eq!(state.outdated_since(&winget("A")), None);
    assert_eq!(state.outdated_since(&winget("B")), Some(T0));
}

#[test]
fn due_on_the_first_run_and_on_the_regular_cadence() {
    let policy = [safe(winget("A"))];
    assert!(UpdateState::default().is_due(T0, None, &policy));

    let state = passed_at(T0, 1);
    assert!(!state.is_due(T0 + TICK_SECS - 1, Some(1), &policy));
    assert!(state.is_due(T0 + TICK_SECS, Some(1), &policy));
}

#[test]
fn due_on_a_new_console_logon_only() {
    let policy = [safe(winget("A"))];
    let state = passed_at(T0, 1);

    assert!(!state.is_due(T0 + 60, Some(1), &policy), "same logon");
    assert!(!state.is_due(T0 + 60, None, &policy), "nobody logged on");
    assert!(state.is_due(T0 + 60, Some(2), &policy), "new logon");
}

#[test]
fn a_logon_pass_with_a_silent_manager_is_retried() {
    let policy = [safe(winget("A"))];
    let mut state = UpdateState::default();

    state.complete_pass(T0, Some(2), false);

    assert!(state.is_due(T0 + 60, Some(2), &policy));
}

#[test]
fn a_force_deadline_wakes_one_pass_and_only_one() {
    let force_after = 5 * DAY + HOUR;
    let policy = [forced_after(winget("A"), force_after)];
    let mut state = passed_at(T0, 1);
    state.observe(&wide_policy(), is_winget, &[winget("A")], T0);
    let deadline = T0 + force_after;

    let mut ran_at = T0;
    for at in (T0..deadline).step_by(TICK_SECS as usize).skip(1) {
        state.complete_pass(at, Some(1), true);
        ran_at = at;
    }
    assert!(!state.is_due(deadline - 1, Some(1), &policy));
    assert!(ran_at < deadline);
    assert!(state.is_due(deadline, Some(1), &policy), "deadline reached");

    state.complete_pass(deadline, Some(1), true);
    assert!(
        !state.is_due(deadline + 60, Some(1), &policy),
        "a failed force is not retried every minute"
    );
}

#[test]
fn a_deadline_passed_while_the_machine_was_off_is_due_at_once() {
    let policy = [forced_after(winget("A"), 5 * DAY)];
    let mut state = passed_at(T0, 1);
    state.observe(&wide_policy(), is_winget, &[winget("A")], T0);

    assert!(state.is_due(T0 + 9 * DAY, None, &policy));
}

#[test]
fn the_state_survives_a_reload() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("package_update_state.json");
    let mut state = passed_at(T0, 7);
    state.observe(&wide_policy(), is_winget, &[winget("A")], T0);

    state.save(&path).unwrap();

    assert_eq!(UpdateState::load(&path), state);
}

#[test]
fn a_missing_or_unreadable_file_starts_over() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("package_update_state.json");
    assert_eq!(UpdateState::load(&path), UpdateState::default());

    std::fs::write(&path, b"[]").unwrap();
    assert_eq!(UpdateState::load(&path), UpdateState::default());
}

#[test]
fn packages_outside_the_policy_are_never_tracked() {
    let mut state = UpdateState::default();

    state.observe(
        &[safe(winget("A"))],
        is_winget,
        &[winget("A"), winget("NotTicked")],
        T0,
    );

    assert_eq!(state.outdated_since(&winget("A")), Some(T0));
    assert_eq!(state.outdated_since(&winget("NotTicked")), None);
}
