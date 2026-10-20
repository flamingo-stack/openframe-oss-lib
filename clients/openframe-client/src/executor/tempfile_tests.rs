use super::*;

#[test]
fn guard_removes_file_on_drop() {
    let path = std::env::temp_dir().join(temp_script_name("sh"));
    std::fs::write(&path, b"x").unwrap();
    assert!(path.exists());
    {
        let _guard = TempFileGuard { path: path.clone() };
    }
    assert!(!path.exists());
}

#[test]
fn names_are_unique() {
    assert_ne!(temp_script_name("ps1"), temp_script_name("ps1"));
}

#[test]
fn powershell_file_has_one_utf8_bom() {
    let cases: &[(&str, &[u8])] = &[
        ("", b"\xef\xbb\xbf"),
        ("Write-Output hi", b"\xef\xbb\xbfWrite-Output hi"),
        ("\u{feff}Write-Output hi", b"\xef\xbb\xbfWrite-Output hi"),
        (
            "\u{feff}\u{feff}Write-Output hi",
            b"\xef\xbb\xbfWrite-Output hi",
        ),
        ("\u{feff}\u{feff}", b"\xef\xbb\xbf"),
        (
            "'—Привет café'\r\n",
            b"\xef\xbb\xbf'\xe2\x80\x94\xd0\x9f\xd1\x80\xd0\xb8\xd0\xb2\xd0\xb5\xd1\x82 caf\xc3\xa9'\r\n",
        ),
        ("'a\u{feff}b'", b"\xef\xbb\xbf'a\xef\xbb\xbfb'"),
    ];
    cases.iter().for_each(|(code, expected)| {
        assert_script_bytes(code, "ps1", expected);
    });
}

#[test]
fn other_script_files_keep_original_bytes() {
    let code = "\u{feff}\u{feff}@echo —Привет café\r\n";
    ["bat", "sh"].iter().for_each(|ext| {
        assert_script_bytes(code, ext, code.as_bytes());
    });
}

fn assert_script_bytes(code: &str, ext: &str, expected: &[u8]) {
    let dir = ::tempfile::tempdir().unwrap();
    let path = dir.path().join(temp_script_name(ext));

    write_temp_script(&path, code, ext).unwrap();

    assert_eq!(std::fs::read(path).unwrap(), expected, "code: {code:?}");
}
