use super::*;

#[test]
fn wire_names_are_the_backend_names_and_parse_back() {
    let cases = [
        (RemoteAccessMode::ApprovalRequired, "APPROVAL_REQUIRED"),
        (RemoteAccessMode::NotifyOnly, "NOTIFY_ONLY"),
        (RemoteAccessMode::SilentAccess, "SILENT_ACCESS"),
        (RemoteAccessMode::DenyAccess, "DENY_ACCESS"),
    ];
    for (mode, name) in cases {
        assert_eq!(mode.wire_name(), name);
        assert_eq!(RemoteAccessMode::from_wire_name(name), Some(mode));
    }
}

#[test]
fn unknown_wire_names_do_not_parse() {
    for name in ["ALLOW", "silent-access", "SilentAccess", ""] {
        assert_eq!(RemoteAccessMode::from_wire_name(name), None, "{name}");
    }
}
