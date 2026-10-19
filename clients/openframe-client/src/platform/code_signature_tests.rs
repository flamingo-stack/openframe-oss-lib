#[cfg(target_os = "macos")]
mod macos {
    use super::super::*;
    use crate::models::CodeSignatureStatus;

    const SIGNED_DETAILS: &str = "Executable=/usr/local/bin/openframe-client\n\
        Identifier=openframe-client\n\
        Format=Mach-O universal (x86_64 arm64)\n\
        TeamIdentifier=F7LDSU8JPJ\n\
        Runtime Version=14.5.0\n";

    #[test]
    fn parses_team_identifier() {
        assert_eq!(
            parse_team_identifier(SIGNED_DETAILS),
            Some("F7LDSU8JPJ".to_string())
        );
    }

    #[test]
    fn ad_hoc_signature_has_no_team_identifier() {
        let details = "Identifier=openframe-client\nSignature=adhoc\nTeamIdentifier=not set\n";
        assert_eq!(parse_team_identifier(details), None);
    }

    #[test]
    fn missing_signature_is_unsigned() {
        let stderr = "/tmp/openframe-client: code object is not signed at all\n";
        assert_eq!(
            classify_failed_verification(stderr).status,
            CodeSignatureStatus::Unsigned
        );
    }

    #[test]
    fn modified_binary_is_invalid() {
        let stderr =
            "/tmp/openframe-client: invalid signature (code or signature have been modified)\n";
        assert_eq!(
            classify_failed_verification(stderr).status,
            CodeSignatureStatus::Invalid
        );
    }

    #[test]
    fn foreign_anchor_is_invalid() {
        let stderr = "/tmp/openframe-client: valid on disk\n\
            /tmp/openframe-client: does not satisfy its designated Requirement\n\
            test-requirement: code failed to satisfy specified code requirement(s)\n";
        assert_eq!(
            classify_failed_verification(stderr).status,
            CodeSignatureStatus::Invalid
        );
    }

    #[tokio::test]
    async fn unsigned_test_binary_is_not_reported_as_valid() {
        let signature = inspect_current_executable().await;
        assert_ne!(signature.status, CodeSignatureStatus::Valid);
    }
}

#[cfg(windows)]
mod windows {
    use super::super::*;
    use crate::models::CodeSignatureStatus;

    #[test]
    fn valid_signature_reports_signer() {
        let signature = parse_authenticode_output("Valid|Flamingo AI, Inc.\r\n");
        assert_eq!(signature.status, CodeSignatureStatus::Valid);
        assert_eq!(signature.signer, "Flamingo AI, Inc.");
    }

    #[test]
    fn not_signed_is_unsigned() {
        let signature = parse_authenticode_output("NotSigned|\r\n");
        assert_eq!(signature.status, CodeSignatureStatus::Unsigned);
    }

    #[test]
    fn hash_mismatch_is_invalid() {
        let signature = parse_authenticode_output("HashMismatch|Flamingo AI, Inc.\r\n");
        assert_eq!(signature.status, CodeSignatureStatus::Invalid);
        assert!(signature.signer.is_empty());
    }

    #[test]
    fn unexpected_output_is_invalid() {
        let signature = parse_authenticode_output("");
        assert_eq!(signature.status, CodeSignatureStatus::Invalid);
    }
}
