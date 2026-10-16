use super::*;
use clap::ValueEnum;

fn install_args(argv: &[&str]) -> Result<InstallArgs, clap::Error> {
    let cli = Cli::try_parse_from(argv)?;
    match cli.command {
        Some(Commands::Install(args)) | Some(Commands::Auth(args)) => Ok(args),
        _ => panic!("expected install or auth"),
    }
}

#[test]
fn install_and_auth_accept_a_remote_access_mode() {
    for command in ["install", "auth"] {
        let args = install_args(&[
            "openframe-client",
            command,
            "--serverUrl",
            "acme.openframe.ai",
            "--remote-access-mode",
            "silent-access",
        ])
        .unwrap();
        assert_eq!(
            args.to_params().remote_access_mode,
            Some(RemoteAccessMode::SilentAccess)
        );
    }
}

#[test]
fn each_cli_name_selects_its_mode() {
    let cases = [
        ("approval-required", RemoteAccessMode::ApprovalRequired),
        ("notify-only", RemoteAccessMode::NotifyOnly),
        ("silent-access", RemoteAccessMode::SilentAccess),
        ("deny-access", RemoteAccessMode::DenyAccess),
    ];
    for (name, mode) in cases {
        let args =
            install_args(&["openframe-client", "install", "--remote-access-mode", name]).unwrap();
        assert_eq!(args.to_params().remote_access_mode, Some(mode));
    }
}

#[test]
fn the_cli_offers_exactly_the_four_modes() {
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
fn remote_access_mode_is_optional() {
    let args = install_args(&["openframe-client", "install", "--serverUrl", "acme"]).unwrap();
    assert_eq!(args.to_params().remote_access_mode, None);
}

#[test]
fn backend_names_are_not_accepted_on_the_cli() {
    let err = install_args(&[
        "openframe-client",
        "install",
        "--remote-access-mode",
        "SILENT_ACCESS",
    ])
    .expect_err("the backend name must not parse");
    assert_eq!(err.kind(), clap::error::ErrorKind::InvalidValue);
}

#[test]
fn unknown_remote_access_mode_is_rejected_at_parse_time() {
    let err = install_args(&[
        "openframe-client",
        "install",
        "--remote-access-mode",
        "allow",
    ])
    .expect_err("an unknown mode must not parse");
    assert_eq!(err.kind(), clap::error::ErrorKind::InvalidValue);
    let message = err.to_string();
    for mode in [
        "approval-required",
        "notify-only",
        "silent-access",
        "deny-access",
    ] {
        assert!(message.contains(mode), "{message}");
    }
}
