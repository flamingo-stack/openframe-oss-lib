use super::*;
use crate::services::package_manager::update_gate::MainImages;

#[test]
fn a_moved_main_executable_is_found_under_the_install_dir() {
    let dir = tempfile::tempdir().unwrap();
    let old = dir.path().join("1.0").join("app.exe");
    let new = dir.path().join("2.0").join("bin").join("App.exe");
    std::fs::create_dir_all(new.parent().unwrap()).unwrap();
    std::fs::write(&new, b"").unwrap();
    let identity = AppIdentity::App {
        install_dir: dir.path().to_path_buf(),
        main_images: MainImages::Unknown,
    };

    assert_eq!(locate(&old, Some(&identity)), Some(new));
}

#[test]
fn an_existing_image_is_used_as_is() {
    let dir = tempfile::tempdir().unwrap();
    let image = dir.path().join("app");
    std::fs::write(&image, b"").unwrap();

    assert_eq!(locate(&image, None), Some(image));
}

#[test]
fn without_an_identity_a_missing_image_is_not_searched() {
    let dir = tempfile::tempdir().unwrap();

    assert_eq!(locate(&dir.path().join("gone"), None), None);
}

#[test]
fn the_shallowest_match_wins() {
    let dir = tempfile::tempdir().unwrap();
    let main = dir.path().join("bin").join("app.exe");
    let helper = dir.path().join("resources").join("helpers").join("app.exe");
    for path in [&main, &helper] {
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, b"").unwrap();
    }

    assert_eq!(
        find_named(dir.path(), OsStr::new("app.exe"), SEARCH_DEPTH),
        Some(main)
    );
}

#[test]
fn the_search_depth_is_bounded() {
    let dir = tempfile::tempdir().unwrap();
    let deep = dir
        .path()
        .join("a")
        .join("b")
        .join("c")
        .join("d")
        .join("app");
    std::fs::create_dir_all(deep.parent().unwrap()).unwrap();
    std::fs::write(&deep, b"").unwrap();

    assert_eq!(
        find_named(dir.path(), OsStr::new("app"), SEARCH_DEPTH),
        None
    );
    assert_eq!(
        find_named(dir.path(), OsStr::new("app"), SEARCH_DEPTH + 1),
        Some(deep)
    );
}
