use super::*;
use crate::models::BrewKind;

fn winget(id: &str) -> PackageRef {
    PackageRef::Winget { id: id.to_string() }
}

fn cask(name: &str) -> PackageRef {
    PackageRef::Brew {
        kind: BrewKind::Cask,
        name: name.to_string(),
    }
}

#[test]
fn winget_ids_match_regardless_of_case() {
    assert!(same_package(
        &winget("Google.Chrome"),
        &winget("google.chrome")
    ));
    assert!(!same_package(
        &winget("Google.Chrome"),
        &winget("Google.Chromium")
    ));
}

#[test]
fn brew_names_match_as_written() {
    assert!(same_package(&cask("postman"), &cask("postman")));
    assert!(!same_package(&cask("postman"), &cask("Postman")));
    assert!(!same_package(&cask("postman"), &winget("postman")));
}

#[test]
fn a_holder_is_named_by_its_image_file() {
    let holder = Holder {
        pid: 42,
        image: std::path::PathBuf::from(
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        ),
    };

    let info = holder_info(&holder, Some("jane".to_string()));

    assert_eq!(info.app, "Google Chrome");
    assert_eq!(info.user.as_deref(), Some("jane"));
}
