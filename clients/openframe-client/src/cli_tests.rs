use super::*;

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
fn remote_access_mode_is_optional() {
    let args = install_args(&["openframe-client", "install", "--serverUrl", "acme"]).unwrap();
    assert_eq!(args.to_params().remote_access_mode, None);
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
