#[cfg(target_os = "windows")]
fn main() -> anyhow::Result<()> {
    use openframe::platform::os_updates::windows::{manageability, read_inventory};

    let inventory = read_inventory();
    let report = serde_json::json!({
        "manageability": manageability(&inventory),
        "inventory": inventory,
    });
    println!("{}", serde_json::to_string_pretty(&report)?);
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn main() {
    eprintln!("probe_os_updates reads Windows Update state and runs on Windows only");
    std::process::exit(2);
}
