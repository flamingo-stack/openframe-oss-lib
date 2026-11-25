use super::*;

const BOUND: Duration = Duration::from_secs(60);

fn message_of<T: std::fmt::Debug>(reading: Reading<T>) -> String {
    let error = reading.expect_err("the script fails");
    assert_eq!(error.step, "test");
    error.message
}

#[test]
fn the_json_a_script_prints_is_the_reading() {
    let facts: WriteFilterFacts = run(
        "test",
        "ConvertTo-Json -Compress -InputObject @{ currentEnabled = $true; nextEnabled = $false }",
        BOUND,
    )
    .unwrap();
    assert!(facts.current_enabled);
    assert!(!facts.next_enabled);
}

#[test]
fn bitlocker_facts_keep_an_empty_and_a_single_protector_as_a_list() {
    for (types, expected) in [("@()", vec![]), ("@(4)", vec![4]), ("@(1, 3)", vec![1, 3])] {
        let script = format!(
            "$t = {types}; ConvertTo-Json -Compress -InputObject \
             @{{ mountPoint = 'C:'; protectionStatus = [uint32]1; protectorTypes = $t }}"
        );
        let facts: BitLockerFacts = run("test", &script, BOUND).unwrap();
        assert_eq!(facts.protector_types, expected, "{types}");
        assert_eq!(facts.protection_status, 1);
    }
}

#[test]
fn null_is_the_absence_of_facts() {
    let facts: Option<BitLockerFacts> = run("test", "'null'; exit 0", BOUND).unwrap();
    assert!(facts.is_none());
}

#[test]
fn a_failed_script_reports_its_stderr() {
    let message = message_of(run::<Option<BitLockerFacts>>(
        "test",
        "[Console]::Error.Write('the reason'); exit 3",
        BOUND,
    ));
    assert!(message.contains("the reason"), "{message}");
    assert!(message.contains('3'), "{message}");
}

#[test]
fn a_long_error_is_not_mistaken_for_a_timeout() {
    let message = message_of(run::<Option<BitLockerFacts>>(
        "test",
        "[Console]::Error.Write('x' * 500000); exit 1",
        BOUND,
    ));
    assert!(message.len() >= 500_000, "{} bytes", message.len());
    assert!(!message.contains("timed out"));
}

#[test]
fn output_that_is_not_the_expected_json_is_an_error() {
    let message = message_of(run::<WriteFilterFacts>("test", "'hello'", BOUND));
    assert!(message.contains("hello"), "{message}");
    message_of(run::<WriteFilterFacts>("test", "", BOUND));
    message_of(run::<WriteFilterFacts>("test", "'null'", BOUND));
}

#[test]
fn a_script_that_hangs_is_killed_at_the_limit() {
    let started = Instant::now();
    let message = message_of(run::<Option<BitLockerFacts>>(
        "test",
        "Start-Sleep -Seconds 120",
        Duration::from_secs(2),
    ));
    assert_eq!(message, "timed out after 2s");
    assert!(started.elapsed() < Duration::from_secs(30));
}

#[test]
fn a_server_without_the_bitlocker_feature_has_no_bitlocker() {
    let script = BITLOCKER_SCRIPT.replace("MicrosoftVolumeEncryption", "NoSuchNamespace");
    assert_ne!(script, BITLOCKER_SCRIPT);
    let facts: Option<BitLockerFacts> = run("test", &script, BOUND).unwrap();
    assert!(facts.is_none());
}

#[test]
fn a_missing_class_is_an_error_and_not_an_absence() {
    let script = BITLOCKER_SCRIPT
        .replace(
            "root/CIMV2/Security/MicrosoftVolumeEncryption",
            "root/CIMV2",
        )
        .replace("Win32_EncryptableVolume", "Win32_NoSuchClass");
    message_of(run::<Option<BitLockerFacts>>("test", &script, BOUND));
}
