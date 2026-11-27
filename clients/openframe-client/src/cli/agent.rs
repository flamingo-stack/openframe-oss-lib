use std::process;

use tokio::runtime::Runtime;
use tracing::{error, info};

use crate::platform::permissions::PermissionUtils;
use crate::service::Service;

pub(super) fn run_as_service() {
    PermissionUtils::require_admin();
    super::init_logging();
    info!("Running as service (called by service manager)");
    PermissionUtils::warn_missing_capabilities();

    if let Err(e) = Service::run_as_service() {
        error!("Service failed: {:#}", e);
        process::exit(1);
    }
}

pub(super) fn run_legacy(rt: &Runtime) {
    PermissionUtils::require_admin();
    super::init_logging();
    info!("No command specified, running as service (legacy mode)");

    if let Err(e) = rt.block_on(Service::run()) {
        error!("Service failed: {:#}", e);
        process::exit(1);
    }
}
