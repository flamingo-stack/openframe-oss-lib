use winreg::enums::{HKEY_CURRENT_USER, REG_BINARY};

use super::*;

const MISSING: &str = r"SOFTWARE\OpenFrame-no-such-key";

struct TestKey {
    path: String,
    key: RegKey,
}

impl TestKey {
    fn create() -> Self {
        let path = format!(r"Software\OpenFrameTests\{}", uuid::Uuid::new_v4());
        let (key, _) = RegKey::predef(HKEY_CURRENT_USER)
            .create_subkey(&path)
            .unwrap();
        Self { path, key }
    }

    fn enrollment(&self, name: &str) -> RegKey {
        self.key.create_subkey(name).unwrap().0
    }
}

impl Drop for TestKey {
    fn drop(&mut self) {
        let _ = RegKey::predef(HKEY_CURRENT_USER).delete_subkey_all(&self.path);
    }
}

#[test]
fn registry_values_keep_their_type() {
    let test = TestKey::create();
    test.key.set_value("dword", &7u32).unwrap();
    test.key.set_value("qword", &u64::MAX).unwrap();
    test.key.set_value("text", &"http://wsus").unwrap();
    test.key
        .set_value("texts", &vec!["one".to_string(), "two".to_string()])
        .unwrap();
    test.key
        .set_raw_value(
            "binary",
            &winreg::RegValue {
                bytes: vec![1, 2, 3],
                vtype: REG_BINARY,
            },
        )
        .unwrap();
    test.key
        .set_raw_value(
            "short dword",
            &winreg::RegValue {
                bytes: vec![9],
                vtype: REG_DWORD,
            },
        )
        .unwrap();

    let read = |name: &str| {
        serde_json::to_value(reg_value(test.key.get_raw_value(name).unwrap())).unwrap()
    };

    assert_eq!(read("dword"), 7);
    assert_eq!(read("qword"), u64::MAX);
    assert_eq!(read("text"), "http://wsus");
    assert_eq!(read("texts"), serde_json::json!(["one", "two"]));
    assert_eq!(read("binary"), serde_json::json!([1, 2, 3]));
    assert_eq!(read("short dword"), serde_json::json!([9]));
}

#[test]
fn only_an_enrollment_with_a_provider_counts() {
    let test = TestKey::create();
    let intune = test.enrollment("intune");
    intune.set_value("ProviderID", &"MS DM Server").unwrap();
    intune.set_value("EnrollmentType", &6u32).unwrap();
    intune.set_value("EnrollmentState", &1u32).unwrap();
    test.enrollment("empty")
        .set_value("ProviderID", &"")
        .unwrap();
    test.enrollment("Context");

    let enrollments = enrollments_under(&test.key).unwrap();

    assert_eq!(enrollments.len(), 1);
    assert_eq!(enrollments[0].provider_id, "MS DM Server");
    assert_eq!(enrollments[0].enrollment_type, Some(6));
    assert_eq!(enrollments[0].enrollment_state, Some(1));
}

#[test]
fn an_enrollment_that_cannot_be_read_is_an_error_and_not_skipped() {
    let test = TestKey::create();
    test.enrollment("odd")
        .set_value("ProviderID", &1u32)
        .unwrap();

    let error = enrollments_under(&test.key).expect_err("fail closed");

    assert_eq!(error.step, ENROLLMENTS);
}

#[test]
fn a_key_that_is_absent_is_not_an_error() {
    assert!(!key_exists(MISSING).unwrap());
    assert!(!has_subkeys(MISSING).unwrap());
    assert!(values(MISSING).unwrap().is_none());
}

#[test]
fn a_key_that_exists_is_read() {
    assert!(key_exists(CURRENT_VERSION).unwrap());
    assert!(has_subkeys(CURRENT_VERSION).unwrap());
    let read = values(CURRENT_VERSION).unwrap().unwrap();
    assert!(matches!(read.get("CurrentBuild"), Some(RegValue::Text(_))));
}

#[test]
fn a_service_that_is_absent_has_no_start_type() {
    let starts = service_start_types(&["EventLog", "OpenFrame-no-such-service"]).unwrap();
    assert_eq!(starts["EventLog"], Some(2));
    assert_eq!(starts["OpenFrame-no-such-service"], None);
    assert_eq!(starts.len(), 2);
}

#[test]
fn the_system_is_described() {
    let system = system_facts().unwrap();
    assert!(system.current_build.parse::<u32>().unwrap() >= 14393);
    assert!(["WinNT", "ServerNT", "LanmanNT"].contains(&system.product_type.as_str()));
    assert!(system.native_architecture.is_some());
    assert!(system.os_name().unwrap().starts_with("Windows"));
    assert!(!system.edition_id.is_empty());
}

#[test]
fn the_remaining_machine_readings_answer() {
    domain_joined().unwrap();
    mdm_enrollments().unwrap();
    pending_file_rename_entries().unwrap();
    defender().unwrap();
}

#[test]
fn an_io_error_carries_its_hresult() {
    let denied = ReadError::io("test", io::Error::from_raw_os_error(5));
    assert_eq!(denied.hresult, Some(0x8007_0005_u32 as i32));
    let without_code = ReadError::io("test", io::Error::other("broken"));
    assert_eq!(without_code.hresult, None);
}
