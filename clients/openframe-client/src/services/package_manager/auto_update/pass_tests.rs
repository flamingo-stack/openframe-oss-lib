use super::*;
use crate::models::UpdatePolicy;

#[test]
fn managers_come_once_each_whatever_the_policy_order() {
    let policy: Vec<PolicyEntry> = [
        PackageRef::Winget { id: "A".into() },
        PackageRef::Choco { id: "b".into() },
        PackageRef::Winget { id: "C".into() },
    ]
    .into_iter()
    .map(|package| PolicyEntry {
        package,
        policy: UpdatePolicy::default(),
    })
    .collect();

    assert_eq!(
        managers_in(&policy),
        vec![ManagerId::Choco, ManagerId::Winget]
    );
}
