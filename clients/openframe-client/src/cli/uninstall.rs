use std::process;

use tokio::runtime::Runtime;
use tracing::{error, info};

use crate::platform::permissions::PermissionUtils;
use crate::service::Service;

pub(super) fn run(rt: &Runtime) -> ! {
    PermissionUtils::require_admin();
    super::init_logging();
    info!("Running uninstall command");

    match rt.block_on(Service::uninstall()) {
        Ok(_) => {
            info!("OpenFrame client service uninstalled successfully");
            process::exit(0);
        }
        Err(e) => {
            error!("Failed to uninstall OpenFrame client service: {:#}", e);
            process::exit(1);
        }
    }
}
