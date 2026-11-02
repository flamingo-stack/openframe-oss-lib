use super::*;

const LIMIT: Duration = Duration::from_secs(10);

fn v(version: &str) -> Version {
    Version::parse(version).unwrap()
}

#[test]
fn the_version_is_read_from_the_first_line_clap_prints() {
    assert_eq!(
        parse_reported_version("openframe-client 1.5.107\n"),
        Some(v("1.5.107"))
    );
    assert_eq!(
        parse_reported_version("\r\n  openframe-client v1.5.107+b2 \r\n"),
        Some(v("1.5.107+b2"))
    );
    assert_eq!(parse_reported_version("openframe-client dev"), None);
    assert_eq!(parse_reported_version("openframe-agent-lib 0.1.0"), None);
    assert_eq!(
        parse_reported_version("warning: something\nopenframe-client 1.5.107"),
        None
    );
}

#[tokio::test]
async fn a_binary_that_cannot_be_run_does_not_block_the_update() {
    let dir = tempfile::tempdir().unwrap();
    let missing = dir.path().join("openframe-client");
    let not_a_binary = dir.path().join("openframe-update-staged");
    std::fs::write(&not_a_binary, b"not an executable format").unwrap();

    for binary in [missing, not_a_binary] {
        assert_eq!(reported_version(&binary, LIMIT).await, None);
        verify_staged_version(&binary, &v("1.5.107"), LIMIT)
            .await
            .unwrap();
    }
}

#[cfg(unix)]
mod unix {
    use super::*;
    use std::path::PathBuf;
    use std::time::Instant;
    use tempfile::TempDir;

    /// A stand-in for the staged binary, written like the stager writes it: without the executable bit.
    fn staged(dir: &TempDir, body: &str) -> PathBuf {
        let path = dir.path().join("openframe-update-staged");
        std::fs::write(&path, format!("#!/bin/sh\n{body}\n")).unwrap();
        path
    }

    #[tokio::test]
    async fn the_staged_binary_is_made_executable_and_its_version_accepted_whatever_the_spelling() {
        let dir = tempfile::tempdir().unwrap();
        let binary = staged(
            &dir,
            r#"[ "$1" = "--version" ] || exit 9
echo "openframe-client v1.5.107+build.9""#,
        );

        verify_staged_version(&binary, &v("1.5.107"), LIMIT)
            .await
            .unwrap();
        assert_eq!(
            reported_version(&binary, LIMIT).await,
            Some(v("1.5.107+build.9"))
        );
    }

    #[tokio::test]
    async fn a_clear_mismatch_refuses_the_update() {
        for (reported, expected) in [("1.5.103", "1.5.107"), ("1.5.107-rc.1", "1.5.107")] {
            let dir = tempfile::tempdir().unwrap();
            let binary = staged(&dir, &format!("echo \"openframe-client {reported}\""));

            let err = verify_staged_version(&binary, &v(expected), LIMIT)
                .await
                .expect_err(reported);

            let reason = format!("{err:#}");
            assert!(reason.contains(reported), "{reason}");
            assert!(reason.contains(expected), "{reason}");
        }
    }

    #[tokio::test]
    async fn a_failing_or_silent_binary_lets_the_update_proceed() {
        let cases = [
            ("echo \"openframe-client 1.5.103\"; exit 3", "non-zero exit"),
            ("echo \"openframe-client dev\"", "no version"),
        ];
        for (body, why) in cases {
            let dir = tempfile::tempdir().unwrap();
            let binary = staged(&dir, body);

            verify_staged_version(&binary, &v("1.5.107"), LIMIT)
                .await
                .unwrap_or_else(|e| panic!("{why}: {e:#}"));
        }
    }

    #[tokio::test]
    async fn a_hanging_binary_is_given_up_at_the_deadline_and_lets_the_update_proceed() {
        let dir = tempfile::tempdir().unwrap();
        let binary = staged(&dir, "exec sleep 30");

        let started = Instant::now();
        verify_staged_version(&binary, &v("1.5.107"), Duration::from_secs(2))
            .await
            .unwrap();

        assert!(started.elapsed() < Duration::from_secs(10));
    }
}
