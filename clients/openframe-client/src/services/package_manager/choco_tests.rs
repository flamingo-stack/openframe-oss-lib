use super::*;

const ROOT: &str = r"C:\ProgramData\chocolatey";

fn customer(version: &str) -> Facts {
    Facts {
        root: ROOT.to_string(),
        version_exit: 0,
        version: version.to_string(),
        pinned: false,
        weak_acl: false,
        signed: true,
        other_install: false,
        licensed: false,
        installed: vec![
            "chocolatey".to_string(),
            "7zip".to_string(),
            "GoogleChrome".to_string(),
        ],
        marker: String::new(),
        upgrade_blocked: String::new(),
        recorded: Vec::new(),
    }
}

fn ours(version: &str) -> Facts {
    Facts {
        marker: format!(r"{ROOT}\"),
        ..customer(version)
    }
}

fn verdict_of(facts: &Facts) -> (Status, Option<Reason>) {
    let report = assess(facts);
    (report.status, report.reason)
}

#[test]
fn a_customer_choco_from_the_floor_up_is_managed() {
    for version in ["2.4.1", "2.6.0", "2.7.5"] {
        assert_eq!(
            verdict_of(&customer(version)),
            (Status::Managed, None),
            "{version}"
        );
    }
}

#[test]
fn a_customer_choco_below_the_floor_asks_for_the_silent_upgrade() {
    for version in ["2.0.0", "2.3.0", "2.4.0"] {
        assert_eq!(
            verdict_of(&customer(version)),
            (Status::UpgradeRequired, None),
            "{version}"
        );
    }
}

#[test]
fn our_choco_below_the_floor_is_upgraded_too() {
    assert_eq!(verdict_of(&ours("2.4.0")), (Status::UpgradeRequired, None));
}

#[test]
fn a_pin_blocks_only_an_upgrade_below_the_floor() {
    let pinned = |version| Facts {
        pinned: true,
        ..customer(version)
    };
    assert_eq!(
        verdict_of(&pinned("2.3.0")),
        (Status::ActionRequired, Some(Reason::Pinned))
    );
    assert_eq!(verdict_of(&pinned("2.7.5")), (Status::Managed, None));
}

#[test]
fn a_blocked_upgrade_holds_until_the_version_changes() {
    let blocked = |version| Facts {
        upgrade_blocked: "2.3.0".to_string(),
        ..customer(version)
    };
    assert_eq!(
        verdict_of(&blocked("2.3.0")),
        (Status::ActionRequired, Some(Reason::UpgradeBlocked))
    );
    assert_eq!(
        verdict_of(&blocked("2.3.1")),
        (Status::UpgradeRequired, None)
    );
    assert_eq!(verdict_of(&blocked("2.7.5")), (Status::Managed, None));
}

#[test]
fn version_1_is_never_upgraded_silently() {
    for version in ["1.4.0", "0.10.15"] {
        assert_eq!(
            verdict_of(&customer(version)),
            (Status::ActionRequired, Some(Reason::Version1)),
            "{version}"
        );
    }
}

#[test]
fn a_licensed_choco_is_left_to_the_admin_at_any_version() {
    for version in ["2.3.0", "2.7.5"] {
        let facts = Facts {
            licensed: true,
            ..customer(version)
        };
        let report = assess(&facts);
        assert_eq!(report.edition, Edition::Licensed);
        assert_eq!(
            (report.status, report.reason),
            (Status::ActionRequired, Some(Reason::Licensed))
        );
    }
}

#[test]
fn a_choco_that_cannot_tell_its_version_is_broken() {
    let failed = Facts {
        version_exit: 1,
        ..customer("2.7.5")
    };
    let garbled = customer("Chocolatey");
    for facts in [failed, garbled] {
        let report = assess(&facts);
        assert_eq!(report.version, None);
        assert_eq!(
            (report.status, report.reason),
            (Status::ActionRequired, Some(Reason::Broken))
        );
    }
}

#[test]
fn an_untrustworthy_install_is_left_to_the_admin_even_when_ours() {
    let cases = [
        (
            Facts {
                other_install: true,
                weak_acl: true,
                ..ours("2.7.5")
            },
            Reason::SeveralInstalls,
        ),
        (
            Facts {
                weak_acl: true,
                signed: false,
                ..ours("2.7.5")
            },
            Reason::WeakAcl,
        ),
        (
            Facts {
                signed: false,
                ..ours("2.7.5")
            },
            Reason::Unsigned,
        ),
    ];
    for (facts, reason) in cases {
        assert_eq!(verdict_of(&facts), (Status::ActionRequired, Some(reason)));
    }
}

#[test]
fn an_untrustworthy_choco_that_was_never_run_is_not_reported_broken() {
    let not_run = || Facts {
        version_exit: -1,
        version: String::new(),
        ..customer("2.7.5")
    };
    let cases = [
        (
            Facts {
                weak_acl: true,
                ..not_run()
            },
            Reason::WeakAcl,
        ),
        (
            Facts {
                signed: false,
                ..not_run()
            },
            Reason::Unsigned,
        ),
    ];
    for (facts, reason) in cases {
        assert_eq!(verdict_of(&facts), (Status::ActionRequired, Some(reason)));
    }
}

#[test]
fn updates_run_only_on_a_managed_choco() {
    assert_eq!(assess(&customer("2.7.5")).refusal(), None);
    assert_eq!(
        assess(&customer("2.3.0")).refusal().as_deref(),
        Some("Chocolatey on this device must be upgraded first")
    );
    let weak = Facts {
        weak_acl: true,
        ..ours("2.7.5")
    };
    assert_eq!(
        assess(&weak).refusal().as_deref(),
        Some("Chocolatey on this device needs action: WeakAcl")
    );
}

#[test]
fn only_an_action_required_choco_offers_admin_options() {
    assert!(assess(&customer("2.7.5")).options.is_empty());
    assert!(assess(&customer("2.3.0")).options.is_empty());
    assert_eq!(
        assess(&customer("1.4.0")).options,
        vec![AdminOption::DontTouch, AdminOption::AdminFix]
    );
}

#[test]
fn our_choco_owns_every_package_but_itself() {
    let report = assess(&ours("2.7.5"));
    assert!(report.ours);
    assert_eq!(report.packages, vec!["7zip", "GoogleChrome"]);
    assert!(report.existing_packages.is_empty());
}

#[test]
fn a_customer_choco_owns_only_the_packages_we_recorded_and_still_installed() {
    let facts = Facts {
        recorded: vec![
            "googlechrome".to_string(),
            "vlc".to_string(),
            "chocolatey".to_string(),
        ],
        ..customer("2.7.5")
    };
    let report = assess(&facts);
    assert!(!report.ours);
    assert_eq!(report.packages, vec!["GoogleChrome"]);
    assert_eq!(report.existing_packages, vec!["7zip"]);
}

#[test]
fn a_marker_for_another_folder_is_not_ours() {
    let facts = Facts {
        marker: r"D:\tools\chocolatey".to_string(),
        ..customer("2.7.5")
    };
    assert!(!assess(&facts).ours);
}

#[test]
fn report_serialises_to_the_agreed_wire_shape() {
    let managed = serde_json::to_string(&assess(&ours("2.7.5"))).unwrap();
    assert_eq!(
        managed,
        r#"{"version":"2.7.5","edition":"OPEN_SOURCE","ours":true,"status":"MANAGED","options":[],"packages":["7zip","GoogleChrome"],"existingPackages":[]}"#
    );

    let action = serde_json::to_string(&assess(&customer("1.4.0"))).unwrap();
    assert_eq!(
        action,
        r#"{"version":"1.4.0","edition":"OPEN_SOURCE","ours":false,"status":"ACTION_REQUIRED","reason":"VERSION_1","options":["DONT_TOUCH","ADMIN_FIX"],"packages":[],"existingPackages":["7zip","GoogleChrome"]}"#
    );
}

#[test]
fn the_facts_script_output_parses() {
    let output = r#"{"root":"C:\\ProgramData\\chocolatey","versionExit":0,"version":"2.7.5","pinned":false,"weakAcl":false,"signed":true,"otherInstall":false,"licensed":false,"installed":["chocolatey","7zip"],"marker":"C:\\ProgramData\\chocolatey","upgradeBlocked":"","recorded":[]}"#;
    let facts: Facts = serde_json::from_str(output).unwrap();
    assert_eq!(verdict_of(&facts), (Status::Managed, None));
    assert!(assess(&facts).ours);
}
