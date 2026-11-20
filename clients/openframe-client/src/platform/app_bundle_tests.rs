use super::*;
use plist::{Dictionary, Value};
use std::path::PathBuf;

fn bundle() -> (tempfile::TempDir, PathBuf) {
    let dir = tempfile::tempdir().unwrap();
    let contents = dir.path().join("Firefox.app").join("Contents");
    std::fs::create_dir_all(&contents).unwrap();
    (dir, contents.join("Info.plist"))
}

fn info(entries: &[(&str, Value)]) -> Value {
    let mut dict = Dictionary::new();
    for (key, value) in entries {
        dict.insert(key.to_string(), value.clone());
    }
    Value::Dictionary(dict)
}

fn app_of(plist: &Path) -> &Path {
    plist.parent().unwrap().parent().unwrap()
}

#[test]
fn the_id_is_read_from_an_xml_or_a_binary_info_plist() {
    let value = info(&[
        (
            "CFBundleIdentifier",
            Value::String("org.mozilla.firefox".into()),
        ),
        (
            "CFBundleShortVersionString",
            Value::String("145.0.1".into()),
        ),
    ]);
    let (_xml_dir, xml) = bundle();
    value.to_file_xml(&xml).unwrap();
    let (_binary_dir, binary) = bundle();
    value.to_file_binary(&binary).unwrap();

    assert_eq!(bundle_id(app_of(&xml)).unwrap(), "org.mozilla.firefox");
    assert_eq!(bundle_id(app_of(&binary)).unwrap(), "org.mozilla.firefox");
}

#[test]
fn a_missing_info_plist_is_an_error() {
    let (_dir, plist) = bundle();

    assert!(bundle_id(app_of(&plist)).is_err());
}

#[test]
fn an_unreadable_info_plist_is_an_error() {
    for bytes in [&b""[..], b"bplist00", b"<plist><dict><key>CFBundle"] {
        let (_dir, plist) = bundle();
        std::fs::write(&plist, bytes).unwrap();

        assert!(bundle_id(app_of(&plist)).is_err(), "{bytes:?}");
    }
}

#[test]
fn an_info_plist_without_a_string_id_is_an_error() {
    let cases = [
        info(&[("CFBundleName", Value::String("Firefox".into()))]),
        info(&[("CFBundleIdentifier", Value::Integer(7.into()))]),
        Value::Array(vec![Value::String("org.mozilla.firefox".into())]),
    ];

    for value in cases {
        let (_dir, plist) = bundle();
        value.to_file_xml(&plist).unwrap();

        assert!(bundle_id(app_of(&plist)).is_err(), "{value:?}");
    }
}

#[test]
fn the_short_version_is_read_and_its_absence_is_an_error() {
    let (_with_dir, with) = bundle();
    info(&[
        (
            "CFBundleIdentifier",
            Value::String("org.mozilla.firefox".into()),
        ),
        (
            "CFBundleShortVersionString",
            Value::String("145.0.1".into()),
        ),
    ])
    .to_file_xml(&with)
    .unwrap();
    let (_without_dir, without) = bundle();
    info(&[(
        "CFBundleIdentifier",
        Value::String("org.mozilla.firefox".into()),
    )])
    .to_file_xml(&without)
    .unwrap();

    assert_eq!(short_version(app_of(&with)).unwrap(), "145.0.1");
    assert!(short_version(app_of(&without)).is_err());
}

#[cfg(unix)]
#[test]
fn the_owner_is_the_bundle_folder_owner_and_a_missing_bundle_is_an_error() {
    let (_dir, plist) = bundle();

    assert_eq!(owner_uid(app_of(&plist)).unwrap(), unsafe {
        libc::getuid()
    });
    assert!(owner_uid(&app_of(&plist).join("Missing.app")).is_err());
}
