use super::*;

#[test]
fn cli_names_map_to_backend_names() {
    let cases = [
        ("approval-required", "APPROVAL_REQUIRED"),
        ("notify-only", "NOTIFY_ONLY"),
        ("silent-access", "SILENT_ACCESS"),
        ("deny-access", "DENY_ACCESS"),
    ];
    for (cli, wire) in cases {
        let mode = RemoteAccessMode::from_str(cli, false).unwrap();
        assert_eq!(mode.as_wire(), wire);
    }
}

#[test]
fn cli_offers_exactly_the_four_modes() {
    let names: Vec<String> = RemoteAccessMode::value_variants()
        .iter()
        .filter_map(|m| m.to_possible_value())
        .map(|v| v.get_name().to_string())
        .collect();
    assert_eq!(
        names,
        [
            "approval-required",
            "notify-only",
            "silent-access",
            "deny-access"
        ]
    );
}

#[test]
fn backend_names_are_not_accepted_on_the_cli() {
    assert!(RemoteAccessMode::from_str("SILENT_ACCESS", false).is_err());
    assert!(RemoteAccessMode::from_str("allow", false).is_err());
}
