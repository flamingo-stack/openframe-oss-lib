use super::*;

#[test]
fn success_means_applied() {
    for status in [StatusCode::OK, StatusCode::CREATED, StatusCode::NO_CONTENT] {
        assert_eq!(classify(status), Some(DeviceModeOutcome::Applied));
    }
}

#[test]
fn not_found_means_not_supported() {
    assert_eq!(
        classify(StatusCode::NOT_FOUND),
        Some(DeviceModeOutcome::NotSupported)
    );
}

#[test]
fn conflict_means_an_override_exists() {
    assert_eq!(
        classify(StatusCode::CONFLICT),
        Some(DeviceModeOutcome::OverrideExists)
    );
}

#[test]
fn other_statuses_are_retried() {
    for status in [
        StatusCode::BAD_REQUEST,
        StatusCode::UNAUTHORIZED,
        StatusCode::FORBIDDEN,
        StatusCode::GONE,
        StatusCode::TOO_MANY_REQUESTS,
        StatusCode::INTERNAL_SERVER_ERROR,
        StatusCode::BAD_GATEWAY,
        StatusCode::SERVICE_UNAVAILABLE,
    ] {
        assert_eq!(classify(status), None, "{status}");
    }
}
