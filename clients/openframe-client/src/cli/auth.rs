use std::process;

use tokio::runtime::Runtime;
use tracing::error;

use super::InstallArgs;
use crate::doctor::DoctorReport;
use crate::installation_initial_config_service::{
    InstallConfigParams, InstallationInitialConfigService,
};
use crate::platform::DirectoryManager;
use crate::service::Service;

pub(super) fn run(args: InstallArgs, rt: &Runtime) {
    crate::banner::print();
    let params = args.to_params();

    let report = preflight(&params, rt);
    super::init_file_logging();
    super::heal_if_needed(&report.results, rt);

    save_authentication(params);
    restart_service(rt);
}

fn preflight(params: &InstallConfigParams, rt: &Runtime) -> DoctorReport {
    let report = rt.block_on(crate::doctor::run_auth(params));
    report.print();

    if report.has_failures() {
        println!(
            "\n{} check(s) failed. Nothing was saved — fix the issues above and run 'openframe-client auth' again.",
            report.failure_count()
        );
        process::exit(1);
    }

    let warns = report.warn_count();
    if warns > 0 {
        println!(
            "\n{} warning(s). Authentication will proceed, but the agent may have connectivity issues.",
            warns
        );
    }

    report
}

fn save_authentication(params: InstallConfigParams) {
    println!("\nSaving authentication...\n");

    let config_service = match InstallationInitialConfigService::new(DirectoryManager::new()) {
        Ok(service) => service,
        Err(e) => {
            error!("Failed to initialize configuration service: {:#}", e);
            process::exit(1);
        }
    };

    if let Err(e) = config_service.build_and_save(params) {
        error!("Failed to save authentication: {:#}", e);
        println!("Authentication failed. Check logs for details.");
        process::exit(1);
    }
}

fn restart_service(rt: &Runtime) -> ! {
    match rt.block_on(Service::nudge_restart()) {
        Ok(()) => {
            println!("Authentication saved. The device will register shortly.");
            process::exit(0);
        }
        Err(e) => {
            error!(
                "Failed to restart the service after saving authentication: {:#}",
                e
            );
            println!("\nAuthentication saved, but the OpenFrame service is stopped and could not be started.");
            println!("The device cannot register until it runs again. Start it with:");
            #[cfg(target_os = "windows")]
            println!("  sc start com.openframe.client");
            #[cfg(target_os = "macos")]
            println!("  sudo launchctl kickstart -k system/com.openframe.client");
            process::exit(1);
        }
    }
}
