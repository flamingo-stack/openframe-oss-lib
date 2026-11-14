use super::*;

const LAST: u64 = 1_000_000;

fn failures(count: u32) -> Option<Failures> {
    Some(Failures {
        count,
        last_at: LAST,
    })
}

#[test]
fn three_failures_in_a_row_wait_a_day() {
    assert!(!resting(None, LAST));
    assert!(!resting(failures(FAILURES_BEFORE_DAILY - 1), LAST + 60));

    assert!(resting(
        failures(FAILURES_BEFORE_DAILY),
        LAST + DAILY_SECS - 1
    ));
    assert!(!resting(failures(FAILURES_BEFORE_DAILY), LAST + DAILY_SECS));
}

#[test]
fn a_clock_set_back_never_waits() {
    assert!(!resting(failures(FAILURES_BEFORE_DAILY), LAST - 1));
}

#[test]
fn success_clears_the_failures_and_each_failure_counts() {
    let now = LAST + 10;

    assert_eq!(settled(failures(2), &HealOutcome::Healed, now), None);
    assert_eq!(
        settled(failures(2), &HealOutcome::RestartRequired, now),
        None
    );
    assert_eq!(
        settled(failures(2), &HealOutcome::StillRunning, now),
        failures(2)
    );
    assert_eq!(
        settled(
            None,
            &HealOutcome::Failed("exited with 1603".to_string()),
            now
        ),
        Some(Failures {
            count: 1,
            last_at: now,
        })
    );
    assert_eq!(
        settled(
            failures(2),
            &HealOutcome::Failed("exited with 1603".to_string()),
            now
        ),
        Some(Failures {
            count: 3,
            last_at: now,
        })
    );
}

#[test]
fn records_each_remediation_on_its_own() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join(RECORD_FILE);
    assert_eq!(load(&path).unwrap(), Record::default());

    save(&path, Remediation::InstallDotnet48, failures(1));
    save(&path, Remediation::InstallWebview2, failures(2));
    save(&path, Remediation::InstallWebview2, None);
    save(&path, Remediation::InstallWebview2, None);

    assert_eq!(
        load(&path).unwrap(),
        Record {
            webview2: None,
            dotnet48: failures(1),
        }
    );
}

#[test]
fn a_corrupt_record_counts_as_no_failures() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join(RECORD_FILE);
    std::fs::write(&path, b"{not json").unwrap();

    assert_eq!(load(&path).unwrap(), Record::default());
}

#[test]
fn a_second_holder_cannot_take_the_lock_until_the_first_lets_go() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join(RECORD_FILE);

    let first = lock(&path).unwrap();
    assert!(first.is_some());
    assert!(lock(&path).unwrap().is_none());

    drop(first);
    assert!(lock(&path).unwrap().is_some());
}

#[test]
fn without_the_chocolatey_flag_dotnet_is_never_checked() {
    assert!(!checks_for(false)
        .iter()
        .any(|result| result.name.contains(".NET")));
}

#[tokio::test]
async fn without_the_chocolatey_flag_the_agent_start_does_nothing() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join(RECORD_FILE);

    heal_on_start(path.clone(), false).await;

    assert!(!path.exists());
    assert!(!path.with_extension("lock").exists());
}
