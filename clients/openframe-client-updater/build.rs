fn main() {
    println!("cargo:rerun-if-env-changed=OPENFRAME_UPDATER_VERSION");
    let version = std::env::var("OPENFRAME_UPDATER_VERSION").unwrap_or_else(|_| {
        panic!("OPENFRAME_UPDATER_VERSION environment variable must be set at build time")
    });
    println!("cargo:rustc-env=OPENFRAME_UPDATER_VERSION={version}");
}
