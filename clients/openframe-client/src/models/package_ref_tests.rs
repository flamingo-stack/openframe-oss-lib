use super::*;

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
    assert!(winget("Google.Chrome").matches(&winget("google.chrome")));
    assert!(!winget("Google.Chrome").matches(&winget("Google.Chromium")));
}

#[test]
fn brew_names_match_as_written() {
    assert!(cask("postman").matches(&cask("postman")));
    assert!(!cask("postman").matches(&cask("Postman")));
    assert!(!cask("postman").matches(&winget("postman")));
}
