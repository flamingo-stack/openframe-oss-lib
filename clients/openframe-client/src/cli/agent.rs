use std::process;

use tokio::runtime::Runtime;
use tracing::{error, info};

use crate::platform::permissions::PermissionUtils;
use crate::platform::DirectoryManager;
use crate::service::Service;
use crate::services::InitialConfigurationService;
use crate::Client;

pub(super) fn run_direct(rt: &Runtime) {
    PermissionUtils::require_admin();
    super::init_logging();
    info!("Running in direct mode (without service wrapper)");
    PermissionUtils::warn_missing_capabilities();

    // Direct mode is interactive, so it reports the missing configuration and
    // exits instead of idling like the service does.
    if !is_configured() {
        println!(
            "Not authenticated yet. Run 'openframe-client auth' with your tenant parameters first."
        );
        process::exit(1);
    }

    let client = Client::new().unwrap_or_else(|e| {
        error!("Failed to initialize client: {:#}", e);
        process::exit(1);
    });

    info!("Starting OpenFrame client in direct mode");
    if let Err(e) = rt.block_on(client.start()) {
        error!("Client failed: {:#}", e);
        process::exit(1);
    }
}

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

fn is_configured() -> bool {
    InitialConfigurationService::new(DirectoryManager::new())
        .map(|service| service.is_configured())
        .unwrap_or(false)
}
