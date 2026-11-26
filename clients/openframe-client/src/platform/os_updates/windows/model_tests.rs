use super::*;
use crate::platform::os_updates::windows::fixtures::{category, manageable, unreadable, update};

type Change = fn(&mut RebootSignals);

fn reboot_after(change: Change) -> RebootPending {
    let mut inventory = manageable();
    change(&mut inventory.reboot);
    RebootPending::from_signals(&inventory.reboot, &inventory.applicable)
}

#[test]
fn any_os_signal_means_a_reboot_is_pending() {
    let cases: [(&str, Change); 4] = [
        ("WUA", |s| s.wua_reboot_required = Ok(true)),
        ("WU key", |s| s.wu_reboot_required_key = Ok(true)),
        ("CBS pending", |s| s.cbs_reboot_pending = Ok(true)),
        ("CBS in progress", |s| s.cbs_reboot_in_progress = Ok(true)),
    ];
    for (signal, change) in cases {
        assert_eq!(reboot_after(change), RebootPending::Yes, "{signal}");
    }
}

#[test]
fn an_unreadable_signal_is_never_no() {
    let cases: [(&str, Change); 4] = [
        ("WUA", |s| s.wua_reboot_required = unreadable()),
        ("WU key", |s| s.wu_reboot_required_key = unreadable()),
        ("CBS pending", |s| s.cbs_reboot_pending = unreadable()),
        ("CBS in progress", |s| {
            s.cbs_reboot_in_progress = unreadable()
        }),
    ];
    for (signal, change) in cases {
        assert_eq!(reboot_after(change), RebootPending::Unknown, "{signal}");
    }
}

#[test]
fn a_signal_that_says_yes_wins_over_an_unreadable_one() {
    let reboot = reboot_after(|signals| {
        signals.wua_reboot_required = unreadable();
        signals.cbs_reboot_pending = Ok(true);
    });
    assert_eq!(reboot, RebootPending::Yes);
}

#[test]
fn pending_file_renames_do_not_count() {
    assert_eq!(
        reboot_after(|signals| signals.pending_file_rename_entries = Ok(6)),
        RebootPending::No
    );
    assert_eq!(
        reboot_after(|signals| signals.pending_file_rename_entries = unreadable()),
        RebootPending::No
    );
}

#[test]
fn an_update_waiting_for_its_restart_means_a_reboot_is_pending() {
    let mut inventory = manageable();
    let mut waiting = update();
    waiting.reboot_required = true;
    inventory.applicable.as_mut().unwrap().updates = vec![update(), waiting];
    assert_eq!(
        RebootPending::from_signals(&inventory.reboot, &inventory.applicable),
        RebootPending::Yes
    );
}

#[test]
fn a_failed_search_leaves_the_decision_to_the_os_signals() {
    assert_eq!(
        RebootPending::from_signals(&manageable().reboot, &unreadable()),
        RebootPending::No
    );
}

#[test]
fn reboot_pending_uses_the_backend_names() {
    let names = [
        RebootPending::Yes,
        RebootPending::No,
        RebootPending::Unknown,
    ]
    .map(|state| serde_json::to_value(state).unwrap());
    assert_eq!(names, ["YES", "NO", "UNKNOWN"]);
}

#[test]
fn the_os_name_is_the_registry_name_with_windows_11_corrected() {
    let cases = [
        (Some("Windows 10 Pro"), "19045", Some("Windows 10 Pro")),
        (Some("Windows 10 Pro"), "21999", Some("Windows 10 Pro")),
        (Some("Windows 10 Pro"), "22000", Some("Windows 11 Pro")),
        (
            Some("Windows 10 Enterprise multi-session"),
            "22631",
            Some("Windows 11 Enterprise multi-session"),
        ),
        (
            Some("Windows Server 2025 Standard"),
            "26100",
            Some("Windows Server 2025 Standard"),
        ),
        (Some("Windows 11 Pro"), "26100", Some("Windows 11 Pro")),
        (Some("Windows 10 Pro"), "unknown", None),
        (None, "26100", None),
    ];
    for (product_name, build, expected) in cases {
        let mut system = manageable().system.unwrap();
        system.product_name = product_name.map(str::to_string);
        system.current_build = build.into();
        assert_eq!(
            system.os_name().as_deref(),
            expected,
            "{product_name:?} {build}"
        );
    }
}

#[test]
fn windows_codes_become_names_and_unknown_codes_become_nothing() {
    use serde_json::{json, to_value, Value};

    let names = |codes: [Value; 7]| codes.to_vec();
    let codes = [-1, 0, 1, 2, 3, 4, 5];
    assert_eq!(
        codes
            .map(|code| to_value(RebootBehavior::from_code(code)).unwrap())
            .to_vec(),
        names([
            Value::Null,
            json!("NEVER"),
            json!("ALWAYS"),
            json!("MAY_REQUIRE"),
            Value::Null,
            Value::Null,
            Value::Null
        ])
    );
    assert_eq!(
        codes
            .map(|code| to_value(UpdateType::from_code(code)).unwrap())
            .to_vec(),
        names([
            Value::Null,
            Value::Null,
            json!("SOFTWARE"),
            json!("DRIVER"),
            Value::Null,
            Value::Null,
            Value::Null
        ])
    );
    assert_eq!(
        codes
            .map(|code| to_value(HistoryOperation::from_code(code)).unwrap())
            .to_vec(),
        names([
            Value::Null,
            Value::Null,
            json!("INSTALL"),
            json!("UNINSTALL"),
            Value::Null,
            Value::Null,
            Value::Null
        ])
    );
    assert_eq!(
        codes
            .map(|code| to_value(HistoryResult::from_code(code)).unwrap())
            .to_vec(),
        names([
            Value::Null,
            Value::Null,
            Value::Null,
            json!("SUCCEEDED"),
            json!("SUCCEEDED_WITH_ERRORS"),
            json!("FAILED"),
            json!("ABORTED")
        ])
    );
}

#[test]
fn the_architecture_uses_the_backend_names() {
    let name =
        |registry: &str| serde_json::to_value(Architecture::from_registry(registry)).unwrap();
    assert_eq!(name("AMD64"), "X86_64");
    assert_eq!(name("ARM64"), "ARM64");
    assert_eq!(name("x86"), serde_json::Value::Null);
}

#[test]
fn definitions_and_upgrades_are_told_by_category_or_kb() {
    let with = |change: fn(&mut WindowsUpdate)| {
        let mut update = update();
        change(&mut update);
        (update.is_definition(), update.is_upgrade())
    };
    assert_eq!(with(|_| {}), (false, false));
    assert_eq!(
        with(|u| u.categories = vec![category(DEFINITION_UPDATES)]),
        (true, false)
    );
    assert_eq!(
        with(|u| u.categories = vec![category(&DEFINITION_UPDATES.to_uppercase())]),
        (true, false)
    );
    assert_eq!(
        with(|u| u.kb_article_ids = vec!["2267602".into()]),
        (true, false)
    );
    assert_eq!(
        with(|u| u.kb_article_ids = vec!["4052623".into()]),
        (true, false)
    );
    assert_eq!(
        with(|u| u.categories = vec![category(UPGRADES)]),
        (false, true)
    );
}
