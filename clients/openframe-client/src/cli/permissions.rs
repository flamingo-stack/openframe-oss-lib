use std::process;

use crate::platform::permissions::{Capability, PermissionUtils};

pub(super) fn run() -> ! {
    let is_admin = PermissionUtils::is_admin();
    println!("Admin privileges: {}", is_admin);
    for cap in [
        Capability::ManageServices,
        Capability::WriteSystemDirectories,
        Capability::ReadSystemLogs,
        Capability::WriteSystemLogs,
    ] {
        println!("{:?}: {}", cap, PermissionUtils::has_capability(cap));
    }
    process::exit(if is_admin { 0 } else { 1 });
}
