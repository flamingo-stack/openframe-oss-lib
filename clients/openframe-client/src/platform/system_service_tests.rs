use super::*;

#[test]
fn start_retry_delays_follow_the_backoff_schedule_then_stop() {
    let delays: Vec<u64> = (1..=SERVICE_START_RETRY_DELAYS_SECS.len())
        .map(|attempt| service_start_retry_delay(attempt).unwrap().as_secs())
        .collect();
    assert_eq!(delays, vec![1, 2, 4, 8, 15]);
    assert_eq!(
        service_start_retry_delay(SERVICE_START_RETRY_DELAYS_SECS.len() + 1),
        None
    );
    assert_eq!(service_start_retry_delay(0), None);
}

#[test]
fn transient_scm_codes_are_retried() {
    // 32 sharing violation, 1053 request timeout, 1055 database locked, 5 access denied
    for code in [32, 1053, 1055, 5] {
        assert!(
            !is_permanent_service_start_code(code),
            "code {code} must be retried"
        );
    }
}

#[test]
fn permanent_scm_codes_fail_fast() {
    // 1060 does not exist, 1058 disabled, 2/3 image path missing, 1072 marked for delete
    for code in [1060, 1058, 2, 3, 1072] {
        assert!(
            is_permanent_service_start_code(code),
            "code {code} must not be retried"
        );
    }
}

#[cfg(target_os = "windows")]
#[test]
fn scm_errors_classify_by_os_code_and_keep_the_stage() {
    let winapi = |code| windows_service::Error::Winapi(std::io::Error::from_raw_os_error(code));
    let missing = ServiceStartFailure::from_scm("open service", &winapi(1060));
    assert!(matches!(missing, ServiceStartFailure::Permanent(_)));
    assert!(missing.message().starts_with("open service: "));
    let held = ServiceStartFailure::from_scm("start call", &winapi(32));
    assert!(matches!(held, ServiceStartFailure::Transient(_)));
    assert!(held.message().contains("os error 32"));
}
