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
fn choco_ids_match_regardless_of_case_and_feed() {
    let choco = |id: &str, feed: &str| PackageRef::Choco {
        id: id.to_string(),
        feed: feed.to_string(),
    };
    let feed = "https://feed.openframe.build/choco/index.json";
    assert!(choco("GoogleChrome", feed).matches(&choco(
        "googlechrome",
        "https://feed.openframe.ai/choco/index.json"
    )));
    assert!(!choco("git", feed).matches(&choco("git.install", feed)));
    assert!(!choco("git", feed).matches(&winget("git")));
}

#[test]
fn brew_names_match_as_written() {
    assert!(cask("postman").matches(&cask("postman")));
    assert!(!cask("postman").matches(&cask("Postman")));
    assert!(!cask("postman").matches(&winget("postman")));
}
