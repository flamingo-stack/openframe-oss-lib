use super::*;
use crate::platform::os_updates::windows::fixtures::{
    at, category, installed, manageable, unreadable, update,
};
use crate::platform::os_updates::windows::{DefenderFacts, NotManageableReason};
use serde_json::{json, Value};

const DRIVERS: &str = "ebfc1fc5-71a4-4f7b-9aca-3b9a503104a0";

fn state_of(inventory: &WindowsInventory) -> UpdateState {
    report(inventory, &Manageability::Manageable)
        .state
        .expect("a manageable device reports its state")
}

fn with_updates(updates: Vec<windows::WindowsUpdate>) -> WindowsInventory {
    let mut inventory = manageable();
    inventory.applicable.as_mut().unwrap().updates = updates;
    inventory
}

fn with_history(entries: Vec<windows::HistoryEntry>) -> WindowsInventory {
    let mut inventory = manageable();
    inventory.history.as_mut().unwrap().entries = entries;
    inventory
}

fn scanned_at(text: Option<&str>) -> WindowsInventory {
    let mut inventory = manageable();
    inventory.last_scan.as_mut().unwrap().last_search_success_at = text.map(at);
    inventory
}

fn changed(change: impl FnOnce(&mut windows::WindowsUpdate)) -> windows::WindowsUpdate {
    let mut update = update();
    change(&mut update);
    update
}

fn titled(title: &str, installed_at: &str) -> windows::HistoryEntry {
    let mut entry = installed();
    entry.title = title.into();
    entry.date = Some(at(installed_at));
    entry
}

#[test]
fn a_manageable_device_reports_the_whole_wire_shape() {
    let mut inventory = with_updates(vec![update()]);
    inventory.defender = Ok(Some(DefenderFacts {
        signature_version: Some("1.463.436.0".into()),
        engine_version: Some("1.1.26100.4".into()),
        signatures_updated_at: Some(at("2026-11-23T19:07:13Z")),
        passive_mode: None,
        service_start: Some(2),
    }));
    inventory.history.as_mut().unwrap().entries = vec![installed()];

    let message = report(&inventory, &Manageability::Manageable);

    assert_eq!(
        serde_json::to_value(&message).unwrap(),
        json!({
            "reportedAt": "2026-11-24T12:00:00Z",
            "platform": "WINDOWS",
            "architecture": "X86_64",
            "osVersion": "11 24H2",
            "osBuild": "26100.4061",
            "osProductName": "Windows 11 Pro",
            "osUpdateAuthorization": "NOT_REQUIRED",
            "manageability": { "state": "MANAGEABLE" },
            "rebootPending": "NO",
            "patchState": "UPDATES_AVAILABLE",
            "scanState": "FRESH",
            "lastScanAt": "2026-11-24T10:00:00Z",
            "updates": {
                "confidence": "CONFIRMED",
                "items": [{
                    "identifier": "11111111-2222-3333-4444-555555555555:200",
                    "displayName": "2026-11 Cumulative Update (KB5068861)",
                    "windows": {
                        "kbArticleIds": ["5068861"],
                        "msrcSeverity": "Critical",
                        "categories": [{
                            "id": "0fa1201d-4330-4fa8-8ae9-b877473b6441",
                            "name": "Security Updates",
                            "kind": "UpdateClassification"
                        }],
                        "cveIds": ["CVE-2026-1"],
                        "publishedAt": "2026-11-10T18:00:00Z",
                        "maxDownloadBytes": 1_200_000_000u64,
                        "isDownloaded": false,
                        "rebootBehavior": "MAY_REQUIRE",
                        "browseOnly": false,
                        "updateType": "SOFTWARE",
                        "rebootRequired": false,
                        "requiresExclusiveInstall": false,
                        "canRequestUserInput": false,
                        "eulaAccepted": true,
                        "autoSelectOnWebSites": true,
                        "isUninstallable": true
                    }
                }]
            },
            "lastOsInstall": {
                "identifier": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee:201",
                "displayName": "2026-10 Cumulative Update (KB5066835)",
                "installedAt": "2026-11-20T03:00:00Z"
            },
            "windows": {
                "editionId": "Professional",
                "displayVersion": "24H2",
                "installationType": "Client",
                "productType": "WinNT",
                "domainJoined": false,
                "domainController": false,
                "clusterNode": false,
                "defender": {
                    "signatureVersion": "1.463.436.0",
                    "engineVersion": "1.1.26100.4",
                    "signaturesUpdatedAt": "2026-11-23T19:07:13Z",
                    "passiveMode": null,
                    "serviceStart": 2
                },
                "updateServices": [{
                    "serviceId": "9482f4b4-e343-43b6-b170-9a65bc822c77",
                    "name": "Windows Update",
                    "isManaged": false,
                    "isRegisteredWithAu": true,
                    "isDefaultAuService": true
                }],
                "history": [{
                    "updateId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
                    "revision": 201,
                    "title": "2026-10 Cumulative Update (KB5066835)",
                    "installedAt": "2026-11-20T03:00:00Z",
                    "operation": "INSTALL",
                    "resultCode": "SUCCEEDED",
                    "hresult": 0
                }]
            }
        })
    );
}

#[test]
fn a_device_that_is_not_manageable_reports_its_os_and_its_reasons_only() {
    let mut inventory = with_updates(vec![update()]);
    inventory.history.as_mut().unwrap().entries = vec![installed()];
    let gate = Manageability::NotManageable {
        reasons: vec![NotManageableReason::Wsus, NotManageableReason::GroupPolicy],
    };

    assert_eq!(
        serde_json::to_value(report(&inventory, &gate)).unwrap(),
        json!({
            "reportedAt": "2026-11-24T12:00:00Z",
            "platform": "WINDOWS",
            "architecture": "X86_64",
            "osVersion": "11 24H2",
            "osBuild": "26100.4061",
            "osProductName": "Windows 11 Pro",
            "osUpdateAuthorization": "NOT_REQUIRED",
            "manageability": {
                "state": "NOT_MANAGEABLE",
                "reasons": ["WSUS", "GROUP_POLICY"]
            }
        })
    );
}

#[test]
fn a_device_whose_system_is_unreadable_still_reports_why() {
    let mut inventory = manageable();
    inventory.system = unreadable();
    let gate = windows::manageability(&inventory);

    let message = serde_json::to_value(report(&inventory, &gate)).unwrap();

    assert_eq!(message["platform"], "WINDOWS");
    assert_eq!(message["manageability"]["reasons"], json!(["UNREADABLE"]));
    assert_eq!(message["osVersion"], Value::Null);
    assert_eq!(message["architecture"], Value::Null);
    assert_eq!(message["osBuild"], Value::Null);
    assert_eq!(message["osProductName"], Value::Null);
    assert!(message.get("updates").is_none());
}

#[test]
fn the_version_is_the_family_and_the_release() {
    let cases = [
        (
            Some("Windows 10 Pro"),
            "26100",
            Some("24H2"),
            Some("2009"),
            Some("11 24H2"),
        ),
        (
            Some("Windows 10 Pro"),
            "19045",
            Some("22H2"),
            Some("2009"),
            Some("10 22H2"),
        ),
        (
            Some("Windows 10 Enterprise LTSC 2021"),
            "19044",
            Some("21H2"),
            Some("2009"),
            Some("10 21H2"),
        ),
        (
            Some("Windows Server 2022 Standard"),
            "20348",
            Some("21H2"),
            Some("2009"),
            Some("2022 21H2"),
        ),
        (
            Some("Windows Server 2016 Standard"),
            "14393",
            None,
            Some("1607"),
            Some("2016 1607"),
        ),
        (
            Some("Windows Next"),
            "30000",
            Some("30H1"),
            None,
            Some("30H1"),
        ),
        (None, "26100", Some("24H2"), None, Some("24H2")),
        (Some("Windows 10 Pro"), "26100", None, None, None),
    ];
    for (product_name, build, display_version, release_id, expected) in cases {
        let mut inventory = manageable();
        let system = inventory.system.as_mut().unwrap();
        system.product_name = product_name.map(str::to_string);
        system.current_build = build.into();
        system.display_version = display_version.map(str::to_string);
        system.release_id = release_id.map(str::to_string);

        let message = report(&inventory, &Manageability::Manageable);

        assert_eq!(
            message.os_version.as_deref(),
            expected,
            "{product_name:?} {build}"
        );
    }
}

#[test]
fn the_build_without_a_revision_is_itself() {
    let mut inventory = manageable();
    inventory.system.as_mut().unwrap().ubr = None;

    let message = report(&inventory, &Manageability::Manageable);

    assert_eq!(message.os_build.as_deref(), Some("26100"));
}

#[test]
fn the_architecture_uses_the_backend_names() {
    for (native, expected) in [
        ("AMD64", json!("X86_64")),
        ("ARM64", json!("ARM64")),
        ("IA64", Value::Null),
    ] {
        let mut inventory = manageable();
        inventory.system.as_mut().unwrap().native_architecture = native.into();
        let message = report(&inventory, &Manageability::Manageable);
        assert_eq!(
            serde_json::to_value(&message).unwrap()["architecture"],
            expected,
            "{native}"
        );
    }
}

#[test]
fn wua_codes_become_the_names_the_backend_parses() {
    let item = |update: windows::WindowsUpdate| {
        serde_json::to_value(&state_of(&with_updates(vec![update])).updates).unwrap()["items"][0]
            ["windows"]
            .clone()
    };
    for (code, expected) in [
        (0, json!("NEVER")),
        (1, json!("ALWAYS")),
        (2, json!("MAY_REQUIRE")),
        (9, Value::Null),
    ] {
        let windows = item(changed(|update| update.reboot_behavior = code));
        assert_eq!(
            windows["rebootBehavior"], expected,
            "reboot behavior {code}"
        );
    }
    for (code, expected) in [
        (1, json!("SOFTWARE")),
        (2, json!("DRIVER")),
        (9, Value::Null),
    ] {
        let windows = item(changed(|update| update.update_type = code));
        assert_eq!(windows["updateType"], expected, "update type {code}");
    }
    for (code, expected) in [(0, false), (1, false), (2, true)] {
        let windows = item(changed(|update| update.impact = code));
        assert_eq!(
            windows["requiresExclusiveInstall"], expected,
            "impact {code}"
        );
    }
}

#[test]
fn finished_history_is_sent_by_name_and_unfinished_history_is_not_sent() {
    let entry = |operation: i32, result_code: i32, hresult: i32| {
        let mut entry = installed();
        entry.operation = operation;
        entry.result_code = result_code;
        entry.hresult = hresult;
        entry
    };
    let cases = [
        (entry(1, 2, 0), Some(("INSTALL", "SUCCEEDED", 0))),
        (
            entry(1, 3, 0),
            Some(("INSTALL", "SUCCEEDED_WITH_ERRORS", 0)),
        ),
        (
            entry(1, 4, -2147023293),
            Some(("INSTALL", "FAILED", -2147023293)),
        ),
        (entry(1, 5, 0), Some(("INSTALL", "ABORTED", 0))),
        (entry(2, 2, 0), Some(("UNINSTALL", "SUCCEEDED", 0))),
        (entry(1, 0, 0), None),
        (entry(1, 1, 0), None),
        (entry(1, 9, 0), None),
        (entry(0, 2, 0), None),
        (entry(3, 2, 0), None),
    ];
    for (entry, expected) in cases {
        let what = format!("operation {} result {}", entry.operation, entry.result_code);
        let history =
            serde_json::to_value(state_of(&with_history(vec![entry])).windows.history).unwrap();
        match expected {
            Some((operation, result, hresult)) => {
                assert_eq!(history[0]["operation"], operation, "{what}");
                assert_eq!(history[0]["resultCode"], result, "{what}");
                assert_eq!(history[0]["hresult"], hresult, "{what}");
            }
            None => assert_eq!(history, json!([]), "{what}"),
        }
    }
}

#[test]
fn history_covers_the_last_thirty_days_and_needs_a_date() {
    let mut undated = installed();
    undated.date = None;
    let inventory = with_history(vec![
        titled("inside", "2026-10-25T12:00:01Z"),
        titled("on the edge", "2026-10-25T12:00:00Z"),
        titled("outside", "2026-10-25T11:59:59Z"),
        undated,
    ]);

    let titles: Vec<String> = state_of(&inventory)
        .windows
        .history
        .unwrap()
        .into_iter()
        .map(|entry| entry.title)
        .collect();

    assert_eq!(titles, ["inside"]);
}

#[test]
fn definition_updates_are_never_sent_as_updates() {
    let by_category = changed(|update| update.categories = vec![category(DEFINITION_UPDATES)]);
    let by_category_upper =
        changed(|update| update.categories = vec![category(&DEFINITION_UPDATES.to_uppercase())]);
    let by_kb = changed(|update| update.kb_article_ids = vec!["2267602".into()]);
    let by_prefixed_kb = changed(|update| update.kb_article_ids = vec!["KB4052623".into()]);

    let state = state_of(&with_updates(vec![
        by_category,
        by_category_upper,
        by_kb,
        by_prefixed_kb,
    ]));

    assert_eq!(state.updates.items.unwrap().len(), 0);
    assert_eq!(state.patch_state, PatchState::UpToDate);
}

#[test]
fn only_installable_updates_put_a_device_behind_but_all_of_them_are_sent() {
    let driver = changed(|update| {
        update.update_type = 2;
        update.categories = vec![category(DRIVERS)];
    });
    let optional = changed(|update| update.browse_only = true);
    let upgrade = changed(|update| update.categories = vec![category(UPGRADES)]);
    let unknown_type = changed(|update| update.update_type = 7);
    let cases = [
        (vec![], PatchState::UpToDate, "nothing"),
        (vec![driver.clone()], PatchState::UpToDate, "a driver"),
        (vec![optional.clone()], PatchState::UpToDate, "an optional"),
        (vec![upgrade.clone()], PatchState::UpToDate, "an upgrade"),
        (
            vec![update()],
            PatchState::UpdatesAvailable,
            "a quality update",
        ),
        (
            vec![unknown_type],
            PatchState::UpdatesAvailable,
            "a type we do not know",
        ),
        (
            vec![driver, optional, upgrade, update()],
            PatchState::UpdatesAvailable,
            "one of each",
        ),
    ];
    for (updates, expected, what) in cases {
        let sent = updates.len();
        let state = state_of(&with_updates(updates));
        assert_eq!(state.patch_state, expected, "{what}");
        assert_eq!(state.updates.items.unwrap().len(), sent, "{what}");
    }
}

#[test]
fn the_scan_state_follows_the_age_of_the_last_scan() {
    let cases = [
        (Some("2026-11-24T12:00:00Z"), ScanState::Fresh, "right now"),
        (Some("2026-11-22T12:00:00Z"), ScanState::Fresh, "48 hours"),
        (
            Some("2026-11-22T11:59:59Z"),
            ScanState::Aging,
            "over 48 hours",
        ),
        (Some("2026-11-17T12:00:00Z"), ScanState::Aging, "7 days"),
        (
            Some("2026-11-17T11:59:59Z"),
            ScanState::Stale,
            "over 7 days",
        ),
        (
            Some("2026-11-24T12:00:01Z"),
            ScanState::Unknown,
            "in the future",
        ),
        (None, ScanState::Unknown, "never"),
    ];
    for (last_scan, expected, what) in cases {
        assert_eq!(
            state_of(&scanned_at(last_scan)).scan_state,
            expected,
            "{what}"
        );
    }
}

#[test]
fn an_empty_list_is_up_to_date_only_after_a_recent_scan() {
    let cases = [
        (Some("2026-11-24T10:00:00Z"), PatchState::UpToDate, "fresh"),
        (Some("2026-11-20T10:00:00Z"), PatchState::UpToDate, "aging"),
        (Some("2026-10-01T10:00:00Z"), PatchState::Unknown, "stale"),
        (
            Some("2026-12-01T10:00:00Z"),
            PatchState::Unknown,
            "in the future",
        ),
        (None, PatchState::Unknown, "never scanned"),
    ];
    for (last_scan, expected, what) in cases {
        assert_eq!(
            state_of(&scanned_at(last_scan)).patch_state,
            expected,
            "{what}"
        );
    }
}

#[test]
fn a_pending_update_is_still_pending_on_a_stale_scan() {
    let mut inventory = scanned_at(Some("2026-10-01T10:00:00Z"));
    inventory.applicable.as_mut().unwrap().updates = vec![update()];
    assert_eq!(
        state_of(&inventory).patch_state,
        PatchState::UpdatesAvailable
    );
}

#[test]
fn only_a_full_search_after_a_scan_is_confirmed() {
    let searched = |code: i32, scanned: bool| {
        let mut inventory = scanned_at(scanned.then_some("2026-11-24T10:00:00Z"));
        let set = inventory.applicable.as_mut().unwrap();
        set.search_result_code = code;
        set.updates = vec![update()];
        state_of(&inventory)
    };
    let cases = [
        (
            2,
            true,
            ListConfidence::Confirmed,
            PatchState::UpdatesAvailable,
        ),
        (3, true, ListConfidence::Unconfirmed, PatchState::Unknown),
        (4, true, ListConfidence::Unconfirmed, PatchState::Unknown),
        (2, false, ListConfidence::Unconfirmed, PatchState::Unknown),
    ];
    for (code, scanned, confidence, patch_state) in cases {
        let state = searched(code, scanned);
        assert_eq!(state.updates.confidence, confidence, "{code} {scanned}");
        assert_eq!(state.patch_state, patch_state, "{code} {scanned}");
        assert!(state.updates.items.is_some(), "{code} {scanned}");
    }
}

#[test]
fn an_unreadable_last_scan_is_not_a_scan() {
    let mut inventory = manageable();
    inventory.last_scan = unreadable();
    let state = state_of(&inventory);
    assert_eq!(state.scan_state, ScanState::Unknown);
    assert_eq!(state.last_scan_at, None);
    assert_eq!(state.updates.confidence, ListConfidence::Unconfirmed);
    assert_eq!(state.patch_state, PatchState::Unknown);
}

#[test]
fn a_failed_search_sends_no_list_so_the_stored_one_stays() {
    let mut inventory = manageable();
    inventory.applicable = unreadable();
    let state = state_of(&inventory);
    assert_eq!(
        serde_json::to_value(&state.updates).unwrap(),
        json!({ "confidence": "UNREADABLE", "items": null })
    );
    assert_eq!(state.patch_state, PatchState::Unknown);
}

#[test]
fn readings_that_failed_are_null_and_not_a_default() {
    let mut inventory = manageable();
    inventory.history = unreadable();
    inventory.defender = unreadable();
    inventory.management.domain_joined = unreadable();
    inventory.management.update_services = unreadable();

    let state = state_of(&inventory);
    let windows = serde_json::to_value(&state.windows).unwrap();

    for field in ["history", "defender", "domainJoined", "updateServices"] {
        assert_eq!(windows[field], Value::Null, "{field}");
    }
    assert!(state.last_os_install.is_none());
}

#[test]
fn the_last_os_install_is_the_newest_successful_update_of_the_os() {
    let failed = {
        let mut entry = titled(
            "2026-11 Cumulative Update (KB5068861)",
            "2026-11-22T03:00:00Z",
        );
        entry.result_code = 4;
        entry
    };
    let uninstalled = {
        let mut entry = titled(
            "2026-11 Cumulative Update (KB5068861)",
            "2026-11-23T03:00:00Z",
        );
        entry.operation = 2;
        entry
    };
    let inventory = with_history(vec![
        titled(
            "Windows Subsystem for Linux 3.0.5.0 (x64)",
            "2026-11-24T03:00:00Z",
        ),
        titled(
            "Removal Tool x64 - v5.147 (KB890830)",
            "2026-11-24T02:00:00Z",
        ),
        titled(
            "Defender platform - KB4052623 (Version 4)",
            "2026-11-24T01:00:00Z",
        ),
        titled("Security Intelligence - KB2267602", "2026-11-24T00:30:00Z"),
        uninstalled,
        failed,
        titled("Обновление (KB5066835)", "2026-10-15T03:00:00Z"),
        titled(
            "2026-08 Cumulative Update (KB5060000)",
            "2026-08-15T03:00:00Z",
        ),
    ]);

    let last = state_of(&inventory).last_os_install.unwrap();

    assert_eq!(last.display_name, "Обновление (KB5066835)");
    assert_eq!(last.installed_at, at("2026-10-15T03:00:00Z"));
    assert_eq!(last.identifier, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee:201");
}

#[test]
fn the_last_os_install_may_be_older_than_the_history_we_send() {
    let state = state_of(&with_history(vec![titled(
        "2026-08 Cumulative Update (KB5060000)",
        "2026-08-15T03:00:00Z",
    )]));
    assert!(state.last_os_install.is_some());
    assert!(state.windows.history.unwrap().is_empty());
}

#[test]
fn server_roles_are_labels() {
    let mut inventory = manageable();
    let system = inventory.system.as_mut().unwrap();
    system.product_type = "LanmanNT".into();
    system.edition_id = "ServerStandard".into();
    system.cluster_node = true;

    let windows = state_of(&inventory).windows;

    assert!(windows.domain_controller);
    assert!(windows.cluster_node);
}
