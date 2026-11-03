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
async fn a_binary_that_cannot_be_run_reports_no_version() {
    let dir = tempfile::tempdir().unwrap();
    let missing = dir.path().join("openframe-client");
    let not_a_binary = dir.path().join("openframe-update-staged");
    std::fs::write(&not_a_binary, b"not an executable format").unwrap();

    for binary in [missing, not_a_binary] {
        assert_eq!(reported_version(&binary, LIMIT).await, None);
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
    async fn the_binary_is_made_executable_and_asked_for_its_version() {
        let dir = tempfile::tempdir().unwrap();
        let binary = staged(
            &dir,
            r#"[ "$1" = "--version" ] || exit 9
echo "openframe-client v1.5.107+build.9""#,
        );

        assert_eq!(
            reported_version(&binary, LIMIT).await,
            Some(v("1.5.107+build.9"))
        );
    }

    #[tokio::test]
    async fn a_failing_binary_reports_no_version() {
        let dir = tempfile::tempdir().unwrap();
        let binary = staged(&dir, "echo \"openframe-client 1.5.103\"; exit 3");

        assert_eq!(reported_version(&binary, LIMIT).await, None);
    }

    #[tokio::test]
    async fn a_hanging_binary_is_given_up_at_the_deadline() {
        let dir = tempfile::tempdir().unwrap();
        let binary = staged(&dir, "exec sleep 30");

        let started = Instant::now();
        assert_eq!(
            reported_version(&binary, Duration::from_secs(2)).await,
            None
        );

        assert!(started.elapsed() < Duration::from_secs(10));
    }
}
