use super::*;

fn v(text: &str) -> OsVersionNumber {
    text.parse().unwrap()
}

#[test]
fn compares_part_by_part_not_as_text() {
    assert!(v("12.7.6") < v("13.0"));
    assert!(v("11.7.10") < v("13.0"));
    assert!(v("13.10") > v("13.9"));
    assert!(v("10.0.22631") > v("10.0.17763"));
}

#[test]
fn missing_parts_count_as_zero() {
    assert_eq!(v("13"), v("13.0"));
    assert_eq!(v("13.0.0"), v("13"));
    assert!(v("13.0.1") > v("13"));
    assert_eq!(v("0"), v("0.0"));
}

#[test]
fn keeps_the_text_it_was_given() {
    assert_eq!(v(" 13.0 ").to_string(), "13.0");
}

#[test]
fn rejects_anything_but_dotted_numbers() {
    for text in [
        "",
        " ",
        ".",
        "13.",
        ".13",
        "13..0",
        "13.x",
        "macOS 13",
        "-1",
        "+13",
        "13.0 (a)",
        "99999999999",
    ] {
        assert!(text.parse::<OsVersionNumber>().is_err(), "{text:?}");
    }
}

#[test]
fn a_malformed_wire_value_fails_deserialization() {
    assert!(serde_json::from_str::<OsVersionNumber>("\"13.x\"").is_err());
    assert!(serde_json::from_str::<OsVersionNumber>("13").is_err());
    assert_eq!(
        serde_json::from_str::<OsVersionNumber>("\"13.0\"").unwrap(),
        v("13")
    );
}
