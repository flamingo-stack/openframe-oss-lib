use openframe::platform::os_updates;
use openframe::services::os_updates::report::report;

fn main() -> anyhow::Result<()> {
    let Some((inventory, manageability)) = os_updates::read() else {
        anyhow::bail!("probe_os_updates reads Windows Update state and runs on Windows only");
    };
    let output = serde_json::json!({
        "manageability": manageability,
        "report": report(&inventory, &manageability),
        "inventory": inventory,
    });
    println!("{}", serde_json::to_string_pretty(&output)?);
    Ok(())
}
