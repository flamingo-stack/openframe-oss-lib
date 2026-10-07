use std::process;

use tokio::runtime::Runtime;
use tracing::error;

use super::InstallArgs;
use crate::doctor::DoctorReport;
use crate::installation_initial_config_service::InstallConfigParams;
use crate::service::Service;

pub(super) fn run(args: InstallArgs, rt: &Runtime) {
    crate::banner::print();
    let params = args.to_params();
    let parameterless = params.is_parameterless();

    let report = preflight(&params, parameterless, rt);
    super::init_file_logging();

    if !Service::is_installed() {
        super::heal_if_needed(&report.results, rt);
    }

    install(params, parameterless, rt);
}

fn preflight(params: &InstallConfigParams, parameterless: bool, rt: &Runtime) -> DoctorReport {
    let report = if parameterless {
        crate::doctor::run_preinstall_parameterless()
    } else {
        rt.block_on(crate::doctor::run_preinstall(params))
    };
    report.print();

    if report.has_failures() {
        println!(
            "\n{} check(s) failed. Please fix the issues above and try again.",
            report.failure_count()
        );
        process::exit(1);
    }

    let warns = report.warn_count();
    if warns > 0 {
        println!("\n{} warning(s). Installation will proceed, but the agent may have connectivity issues.", warns);
    }

    report
}

fn install(params: InstallConfigParams, parameterless: bool, rt: &Runtime) -> ! {
    println!("\nStarting installation...\n");

    match rt.block_on(Service::install(params)) {
        Ok(_) => {
            println!("OpenFrame agent installed successfully.");
            if parameterless {
                print_next_steps();
            }
            process::exit(0);
        }
        Err(e) => {
            error!("Install failed: {:#}", e);
            println!("Installation failed. Check logs for details.");
            process::exit(1);
        }
    }
}

fn print_next_steps() {
    println!("\nNot authenticated yet. Get your auth command from your OpenFrame dashboard → Devices → Add device.");
    #[cfg(target_os = "windows")]
    println!("Open a new terminal first so the 'openframe-client' command is on PATH.");
    println!("Updates are managed by the OpenFrame platform.");
}
