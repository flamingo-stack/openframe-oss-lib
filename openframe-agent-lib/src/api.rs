//! Public API for the OpenFrame Agent library.
//!
//! This module contains all public-facing functions, types, and the main entry point
//! for consumer projects to use the library.

use anyhow::Result;
use tracing::{error, info, warn};

use crate::installation_initial_config_service::InstallConfigParams;
use crate::logging;
use crate::platform::permissions::{Capability, PermissionUtils};
use crate::service::Service;
use crate::Client;

// =============================================================================
// Public helper functions
// =============================================================================

/// Check if the current process has admin/root privileges.
/// Returns `true` if running as admin (Windows) or root (Unix).
pub fn is_admin() -> bool {
    PermissionUtils::is_admin()
}

/// Ensure the process is running with admin/root privileges.
/// Exits the process with code 1 if not running as admin.
pub fn ensure_admin_privileges() {
    #[cfg(unix)]
    {
        if unsafe { libc::geteuid() } != 0 {
            eprintln!("Please run application with administrator/root privileges");
            std::process::exit(1);
        }
    }

    #[cfg(windows)]
    {
        if !PermissionUtils::is_admin() {
            eprintln!("Please run application with administrator privileges");
            std::process::exit(1);
        }
    }
}

/// Check for capabilities and log warnings if missing.
/// Useful for diagnostics when running in direct mode.
pub fn check_capabilities_and_warn() {
    if !PermissionUtils::has_capability(Capability::ManageServices) {
        warn!("Process doesn't have capability to manage services");
    }

    if !PermissionUtils::has_capability(Capability::WriteSystemDirectories) {
        warn!("Process doesn't have capability to write to system directories");
    }

    if !PermissionUtils::has_capability(Capability::ReadSystemLogs) {
        warn!("Process doesn't have capability to read system logs");
    }

    if !PermissionUtils::has_capability(Capability::WriteSystemLogs) {
        warn!("Process doesn't have capability to write system logs");
    }
}

/// Print permission diagnostics to stdout.
/// Returns exit code: 0 if admin, 1 if not admin.
pub fn print_permission_diagnostics() -> i32 {
    let is_admin = PermissionUtils::is_admin();

    println!("Admin privileges: {}", is_admin);
    println!(
        "Manage services capability: {}",
        PermissionUtils::has_capability(Capability::ManageServices)
    );
    println!(
        "Write system directories capability: {}",
        PermissionUtils::has_capability(Capability::WriteSystemDirectories)
    );
    println!(
        "Read system logs capability: {}",
        PermissionUtils::has_capability(Capability::ReadSystemLogs)
    );
    println!(
        "Write system logs capability: {}",
        PermissionUtils::has_capability(Capability::WriteSystemLogs)
    );

    if is_admin {
        0
    } else {
        1
    }
}

// =============================================================================
// Command enum and main entry point
// =============================================================================

/// Commands that can be executed by the agent
#[derive(Debug, Clone)]
pub enum AgentCommand {
    /// Install the OpenFrame client as a system service
    Install(InstallConfigParams),
    /// Uninstall the OpenFrame client service
    Uninstall,
    /// Run the OpenFrame client directly (not as a service)
    Run,
    /// Run as a service (used by service manager)
    RunAsService,
    /// Check if the current process has the required permissions
    CheckPermissions,
}

/// Main entry point for the OpenFrame agent library.
///
/// This function initializes logging, checks privileges, and executes the given command.
/// It mirrors the logic from the original main.rs but is callable from any consumer project.
///
/// # Arguments
/// * `command` - The command to execute. If `None`, runs in legacy service mode.
///
/// # Returns
/// * `Ok(())` on success
/// * `Err` with appropriate error message on failure
///
/// # Example
/// ```ignore
/// use openframe_agent::{run, AgentCommand, InstallConfigParams};
///
/// // Run as service
/// run(None)?;
///
/// // Install with parameters
/// let params = InstallConfigParams {
///     server_url: Some("example.com".to_string()),
///     initial_key: Some("key123".to_string()),
///     org_id: Some("org1".to_string()),
///     local_mode: false,
/// };
/// run(Some(AgentCommand::Install(params)))?;
/// ```
pub fn run(command: Option<AgentCommand>) -> Result<()> {
    use std::process;
    use tokio::runtime::Runtime;

    // Ensure the process is running with sufficient privileges (root/administrator)
    ensure_admin_privileges();

    // Initialize logging first
    if let Err(e) = logging::init(None, None) {
        eprintln!("Failed to initialize logging: {}", e);
        process::exit(1);
    }

    // Add explicit startup log entry to verify logging is working
    info!("OpenFrame agent starting up");

    // Check if running with admin privileges
    let is_admin = PermissionUtils::is_admin();
    info!("Running with admin privileges: {}", is_admin);

    let rt = Runtime::new()?;

    match command {
        Some(AgentCommand::Install(params)) => {
            info!("Running install command");
            // Check for admin privileges - this is required for installation
            if !is_admin {
                error!("Admin/root privileges are required for service installation");
                eprintln!("Please run the installation with administrator/root privileges");
                process::exit(1);
            }

            rt.block_on(async {
                match Service::install(params).await {
                    Ok(_) => {
                        info!("OpenFrame client service installed successfully");
                        process::exit(0);
                    }
                    Err(e) => {
                        error!("Failed to install OpenFrame client service: {:#}", e);
                        process::exit(1);
                    }
                }
            });
        }
        Some(AgentCommand::Uninstall) => {
            info!("Running uninstall command");
            // Check for admin privileges - this is required for uninstallation
            if !is_admin {
                error!("Admin/root privileges are required for service uninstallation");
                eprintln!("Please run the uninstallation with administrator/root privileges");
                process::exit(1);
            }

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
        Some(AgentCommand::Run) => {
            info!("Running in direct mode (without service wrapper)");

            // For direct mode, check capabilities but don't require admin
            // Just warn if we don't have certain capabilities
            check_capabilities_and_warn();

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
        Some(AgentCommand::RunAsService) => {
            info!("Running as service (called by service manager)");
            // When running as a service, we should already have the necessary permissions
            // But we'll still check and log any issues
            check_capabilities_and_warn();

            // This command is used when started by the service manager
            // Note: run_as_service is now synchronous and handles its own runtime
            if let Err(e) = Service::run_as_service() {
                error!("Service failed: {:#}", e);
                process::exit(1);
            }
        }
        Some(AgentCommand::CheckPermissions) => {
            // This command is used to check if we have the necessary permissions
            // Useful for diagnostics and troubleshooting
            let exit_code = print_permission_diagnostics();
            process::exit(exit_code);
        }
        None => {
            info!("No command specified, running as service (legacy mode)");
            // Run as service by default for backward compatibility
            if let Err(e) = rt.block_on(Service::run()) {
                error!("Service failed: {:#}", e);
                process::exit(1);
            }
        }
    }

    // Add explicit shutdown log entry to verify logging is still working
    info!("OpenFrame agent shutting down");

    Ok(())
}
