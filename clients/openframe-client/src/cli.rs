use crate::installation_initial_config_service::InstallConfigParams;
use crate::platform::permissions::{Capability, PermissionUtils};
use crate::{service::Service, Client};
use anyhow::Result;
use clap::{Args, Parser, Subcommand};
use std::process;

use tokio::runtime::Runtime;
use tracing::{error, info};

#[derive(Parser)]
#[command(author, version, about, long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Args, Debug, Clone)]
struct InstallArgs {
    #[arg(long = "serverUrl")]
    server_url: Option<String>,

    #[arg(long = "initialKey")]
    initial_key: Option<String>,

    #[arg(long = "localMode", default_value_t = false)]
    local_mode: bool,

    #[arg(long = "orgId")]
    org_id: Option<String>,

    #[arg(long = "userId")]
    user_id: Option<String>,

    #[arg(long = "tag")]
    tags: Vec<String>,
}

impl InstallArgs {
    fn to_params(&self) -> InstallConfigParams {
        InstallConfigParams {
            server_url: self.server_url.clone(),
            initial_key: self.initial_key.clone(),
            org_id: self.org_id.clone(),
            user_id: self.user_id.clone(),
            local_mode: self.local_mode,
            tags: self.tags.clone(),
        }
    }
}

#[derive(Subcommand)]
enum Commands {
    /// Install the OpenFrame client as a system service
    Install(InstallArgs),
    /// Authenticate an installed client with its tenant (second step after a parameterless install)
    Auth(InstallArgs),
    /// Uninstall the OpenFrame client service
    Uninstall,
    /// Run the OpenFrame client directly (not as a service)
    Run,
    /// Run as a service (used by service manager)
    #[command(hide = true)]
    RunAsService,
    /// Check if the current process has the required permissions
    #[command(hide = true)]
    CheckPermissions,
    /// Run environment health check (reads config from installed agent)
    Doctor,
}

/// Parse CLI arguments and run the requested OpenFrame client command.
pub fn run() -> Result<()> {
    crate::platform::configure_console();

    let cli = Cli::parse();
    let rt = Runtime::new()?;

    match cli.command {
        Some(Commands::Install(args)) => {
            crate::banner::print();
            let params = args.to_params();
            let parameterless = params.is_parameterless();

            // A parameterless (package-manager) install validates only what this step
            // does — admin and the environment. Argument, network and WebView2 checks
            // move to `auth`, where the tenant parameters finally exist.
            let report = if parameterless {
                crate::doctor::run_preinstall_parameterless()
            } else {
                rt.block_on(crate::doctor::run_preinstall(&params))
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
            let heal_candidates = report.results;

            if let Err(e) = crate::logging::init_file_only(None, None) {
                eprintln!("Failed to initialize logging: {}", e);
                process::exit(1);
            }

            // Healing runs only on a fresh install; a reinstall (existing client present) skips it.
            if !Service::is_installed()
                && !crate::doctor::healing::pending(&heal_candidates).is_empty()
            {
                println!("\nAttempting automatic fixes (this may take a few minutes)...");
                let heals = rt.block_on(crate::doctor::healing::heal(&heal_candidates));
                print_heal_outcomes(&heals);
            }

            println!("\nStarting installation...\n");

            rt.block_on(async {
                match Service::install(params).await {
                    Ok(_) => {
                        println!("OpenFrame agent installed successfully.");
                        if parameterless {
                            println!("\nNot authenticated yet. Get your auth command from your OpenFrame dashboard → Devices → Add device.");
                            #[cfg(target_os = "windows")]
                            println!("Open a new terminal first so the 'openframe' command is on PATH.");
                            println!("Updates are managed by the OpenFrame platform.");
                        }
                        process::exit(0);
                    }
                    Err(e) => {
                        error!("Install failed: {:#}", e);
                        println!("Installation failed. Check logs for details.");
                        process::exit(1);
                    }
                }
            });
        }
        Some(Commands::Auth(args)) => {
            crate::banner::print();
            let params = args.to_params();

            let report = rt.block_on(crate::doctor::run_auth(&params));
            report.print();

            if report.has_failures() {
                println!(
                    "\n{} check(s) failed. Nothing was saved — fix the issues above and run 'openframe auth' again.",
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

            if let Err(e) = crate::logging::init_file_only(None, None) {
                eprintln!("Failed to initialize logging: {}", e);
                process::exit(1);
            }

            // Same checks → heal → act ordering as the parameterized install flow.
            if !crate::doctor::healing::pending(&report.results).is_empty() {
                println!("\nAttempting automatic fixes (this may take a few minutes)...");
                let heals = rt.block_on(crate::doctor::healing::heal(&report.results));
                print_heal_outcomes(&heals);
            }

            println!("\nSaving authentication...\n");

            let config_service = match crate::installation_initial_config_service::InstallationInitialConfigService::new(
                crate::platform::DirectoryManager::new(),
            ) {
                Ok(service) => service,
                Err(e) => {
                    error!("Failed to initialize configuration service: {:#}", e);
                    process::exit(1);
                }
            };

            match config_service.build_and_save(params) {
                Ok(()) => {
                    // Restart so the new configuration is picked up now — and so a
                    // re-auth on an already-running client takes effect at all.
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
                            println!(
                                "The device cannot register until it runs again. Start it with:"
                            );
                            #[cfg(target_os = "windows")]
                            println!("  sc start com.openframe.client");
                            #[cfg(target_os = "macos")]
                            println!("  sudo launchctl kickstart -k system/com.openframe.client");
                            process::exit(1);
                        }
                    }
                }
                Err(e) => {
                    error!("Failed to save authentication: {:#}", e);
                    println!("Authentication failed. Check logs for details.");
                    process::exit(1);
                }
            }
        }
        Some(Commands::Doctor) => {
            let report = rt.block_on(crate::doctor::run_healthcheck());
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
                println!(
                    "\n{} warning(s). The agent may have connectivity issues.",
                    warns
                );
                process::exit(1);
            }

            println!("\nAll checks passed.");
            process::exit(0);
        }
        Some(Commands::Uninstall) => {
            PermissionUtils::require_admin();
            init_logging();
            info!("Running uninstall command");

            rt.block_on(async {
                match Service::uninstall().await {
                    Ok(_) => {
                        info!("OpenFrame client service uninstalled successfully");
                        process::exit(0);
                    }
                    Err(e) => {
                        error!("Failed to uninstall OpenFrame client service: {:#}", e);
                        process::exit(1);
                    }
                }
            });
        }
        Some(Commands::Run) => {
            PermissionUtils::require_admin();
            init_logging();
            info!("Running in direct mode (without service wrapper)");
            PermissionUtils::warn_missing_capabilities();

            // Direct mode is interactive, so it reports the missing configuration and
            // exits instead of idling like the service does.
            if !crate::services::InitialConfigurationService::new(
                crate::platform::DirectoryManager::new(),
            )
            .map(|service| service.is_configured())
            .unwrap_or(false)
            {
                println!("Not authenticated yet. Run 'openframe auth' with your tenant parameters first.");
                process::exit(1);
            }

            // Run directly without service wrapper
            match Client::new() {
                Ok(client) => {
                    info!("Starting OpenFrame client in direct mode");
                    if let Err(e) = rt.block_on(client.start()) {
                        error!("Client failed: {:#}", e);
                        process::exit(1);
                    }
                }
                Err(e) => {
                    error!("Failed to initialize client: {:#}", e);
                    process::exit(1);
                }
            }
        }
        Some(Commands::RunAsService) => {
            PermissionUtils::require_admin();
            init_logging();
            info!("Running as service (called by service manager)");
            PermissionUtils::warn_missing_capabilities();

            if let Err(e) = Service::run_as_service() {
                error!("Service failed: {:#}", e);
                process::exit(1);
            }
        }
        Some(Commands::CheckPermissions) => {
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
        None => {
            PermissionUtils::require_admin();
            init_logging();
            info!("No command specified, running as service (legacy mode)");

            if let Err(e) = rt.block_on(Service::run()) {
                error!("Service failed: {:#}", e);
                process::exit(1);
            }
        }
    }

    Ok(())
}

fn init_logging() {
    if let Err(e) = crate::logging::init(None, None) {
        eprintln!("Failed to initialize logging: {}", e);
        process::exit(1);
    }
}

fn print_heal_outcomes(heals: &[crate::doctor::healing::HealResult]) {
    use crate::doctor::healing::HealOutcome;
    use crate::doctor::Remediation;
    for heal in heals {
        let label = match heal.remediation {
            Remediation::InstallWebview2 => "WebView2 Runtime install",
        };
        match &heal.outcome {
            HealOutcome::Healed => println!("  [+] {} fixed", label),
            HealOutcome::Failed(e) => println!("  [x] {} failed: {}", label, e),
        }
    }
}
