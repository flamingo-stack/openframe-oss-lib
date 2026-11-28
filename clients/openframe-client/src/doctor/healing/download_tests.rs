use super::*;

#[test]
fn only_our_staged_installers_in_the_secured_folder_count() {
    let secured = Path::new(r"C:\ProgramData\OpenFrame\secured");
    let prefix = "ndp48-x86-x64-allos-enu";

    assert!(is_staged(
        Path::new(r"C:\ProgramData\OpenFrame\secured\ndp48-x86-x64-allos-enu-1b4e28ba.exe"),
        secured,
        prefix
    ));
    assert!(is_staged(
        Path::new(r"c:\programdata\openframe\SECURED\NDP48-x86-x64-AllOS-ENU-1b4e28ba.EXE"),
        secured,
        prefix
    ));
    assert!(!is_staged(
        Path::new(r"C:\Users\Public\ndp48-x86-x64-allos-enu-1b4e28ba.exe"),
        secured,
        prefix
    ));
    assert!(!is_staged(
        Path::new(r"C:\ProgramData\OpenFrame\secured\ndp48-x86-x64-allos-enu.txt"),
        secured,
        prefix
    ));
    assert!(!is_staged(
        Path::new(r"C:\ProgramData\OpenFrame\secured\dotnet48-install.txt"),
        secured,
        prefix
    ));
}
