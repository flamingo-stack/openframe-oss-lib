use super::*;

#[test]
fn installer_exit_codes_map_to_heal_outcomes() {
    assert!(matches!(outcome(Some(0), true), HealOutcome::Healed));
    assert!(matches!(
        outcome(Some(3010), false),
        HealOutcome::RestartRequired
    ));
    assert!(matches!(
        outcome(Some(1641), true),
        HealOutcome::RestartRequired
    ));
    assert!(matches!(
        outcome(Some(0), false),
        HealOutcome::Failed(message) if message.contains("still not detected")
    ));
    assert!(matches!(
        outcome(Some(5100), false),
        HealOutcome::Failed(message) if message.contains("requirements")
    ));
    assert!(matches!(
        outcome(Some(1603), false),
        HealOutcome::Failed(message) if message.ends_with("exited with 1603")
    ));
    assert!(matches!(outcome(None, false), HealOutcome::Failed(_)));
}
