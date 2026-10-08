mod agent;
mod auth;
mod healthcheck;
mod install;
mod permissions;
mod uninstall;

use crate::doctor::healing::{HealOutcome, HealResult};
use crate::doctor::{CheckResult, Remediation};
use crate::installation_initial_config_service::InstallConfigParams;
use anyhow::Result;
use clap::{Args, Parser, Subcommand};
use std::process;

use tokio::runtime::Runtime;

#[derive(Parser)]
#[command(name = "openframe-client", author, version = env!("OPENFRAME_VERSION"), about, long_about = None)]
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
    #[command(hide = true)]
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
        Some(Commands::Install(args)) => install::run(args, &rt),
        Some(Commands::Auth(args)) => auth::run(args, &rt),
        Some(Commands::Doctor) => healthcheck::run(&rt),
        Some(Commands::Uninstall) => uninstall::run(&rt),
        Some(Commands::Run) => agent::run_direct(&rt),
        Some(Commands::RunAsService) => agent::run_as_service(),
        Some(Commands::CheckPermissions) => permissions::run(),
        None => agent::run_legacy(&rt),
    }

    Ok(())
}

fn init_logging() {
    if let Err(e) = crate::logging::init(None, None) {
        eprintln!("Failed to initialize logging: {}", e);
        process::exit(1);
    }
}

fn init_file_logging() {
    if let Err(e) = crate::logging::init_file_only(None, None) {
        eprintln!("Failed to initialize logging: {}", e);
        process::exit(1);
    }
}

fn heal_if_needed(results: &[CheckResult], rt: &Runtime) {
    if crate::doctor::healing::pending(results).is_empty() {
        return;
    }

    println!(
        "
Attempting automatic fixes (this may take a few minutes)..."
    );
    let heals = rt.block_on(crate::doctor::healing::heal(results));
    print_heal_outcomes(&heals);
}

fn print_heal_outcomes(heals: &[HealResult]) {
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
