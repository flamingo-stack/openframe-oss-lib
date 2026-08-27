pub mod checks;
pub mod healing;

use crate::installation_initial_config_service::InstallConfigParams;
use crate::platform::DirectoryManager;
use crate::service::Service;
use checks::*;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CheckCategory {
    Command,
    Admin,
    Runtime,
    Disk,
    Network,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CheckStatus {
    Pass,
    Fail,
    Warn,
    Info,
}

/// Automatic fix the healing submodule can run when a check flags it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Remediation {
    InstallWebview2,
}

#[derive(Debug)]
pub struct CheckResult {
    pub category: CheckCategory,
    pub status: CheckStatus,
    pub name: String,
    pub hint: Option<String>,
    pub remediation: Option<Remediation>,
}

impl CheckResult {
    pub fn pass(category: CheckCategory, name: &str) -> Self {
        Self {
            category,
            status: CheckStatus::Pass,
            name: name.to_string(),
            hint: None,
            remediation: None,
        }
    }

    pub fn fail(category: CheckCategory, name: &str, hint: impl Into<String>) -> Self {
        Self {
            category,
            status: CheckStatus::Fail,
            name: name.to_string(),
            hint: Some(hint.into()),
            remediation: None,
        }
    }

    pub fn warn(category: CheckCategory, name: &str, hint: impl Into<String>) -> Self {
        Self {
            category,
            status: CheckStatus::Warn,
            name: name.to_string(),
            hint: Some(hint.into()),
            remediation: None,
        }
    }

    pub fn info(category: CheckCategory, name: &str) -> Self {
        Self {
            category,
            status: CheckStatus::Info,
            name: name.to_string(),
            hint: None,
            remediation: None,
        }
    }

    pub fn with_remediation(mut self, remediation: Remediation) -> Self {
        self.remediation = Some(remediation);
        self
    }
}

pub struct DoctorReport {
    pub results: Vec<CheckResult>,
    title: &'static str,
}

impl DoctorReport {
    pub fn has_failures(&self) -> bool {
        self.results.iter().any(|r| r.status == CheckStatus::Fail)
    }

    pub fn failure_count(&self) -> usize {
        self.results
            .iter()
            .filter(|r| r.status == CheckStatus::Fail)
            .count()
    }

    pub fn warn_count(&self) -> usize {
        self.results
            .iter()
            .filter(|r| r.status == CheckStatus::Warn)
            .count()
    }

    pub fn print(&self) {
        println!("\nOpenFrame Doctor \u{2014} {}\n", self.title);
        for r in &self.results {
            let icon = match r.status {
                CheckStatus::Pass => "+",
                CheckStatus::Fail => "x",
                CheckStatus::Warn => "!",
                CheckStatus::Info => "i",
            };
            println!("  [{}] {}", icon, r.name);
            if let Some(hint) = &r.hint {
                println!("      {}", hint);
            }
        }
    }
}

/// Pre-install diagnostics. Validates CLI args, admin, disk, network.
pub async fn run_preinstall(params: &InstallConfigParams) -> DoctorReport {
    let mut results = Vec::new();

    results.push(check_required_args(params));
    if results.last().unwrap().status == CheckStatus::Fail {
        return DoctorReport {
            results,
            title: "pre-install diagnostics",
        };
    }

    results.push(check_admin_privileges());
    if results.last().unwrap().status == CheckStatus::Fail {
        return DoctorReport {
            results,
            title: "pre-install diagnostics",
        };
    }

    if let Some(webview2) = check_webview2_runtime() {
        results.push(webview2);
    }

    let dir_manager = DirectoryManager::new();
    let disk_targets: Vec<(&std::path::Path, &str)> = vec![
        (
            dir_manager.app_support_dir(),
            dir_manager
                .app_support_dir()
                .to_str()
                .unwrap_or("app support"),
        ),
        (
            dir_manager.secured_dir(),
            dir_manager.secured_dir().to_str().unwrap_or("secured"),
        ),
        (
            dir_manager.logs_dir(),
            dir_manager.logs_dir().to_str().unwrap_or("logs"),
        ),
    ];

    let install_path = Service::get_install_location();
    let bin_dir = install_path.parent().unwrap_or(&install_path);
    results.push(check_dir_writable(bin_dir, &bin_dir.display().to_string()));
    results.push(check_disk_space(dir_manager.app_support_dir(), 200));

    for (path, label) in &disk_targets {
        results.push(check_dir_writable(path, label));
    }

    results.push(check_service_config_writable());

    let server_url = params.server_url.as_deref().unwrap_or_default();
    run_network_checks(&mut results, server_url).await;

    DoctorReport {
        results,
        title: "pre-install diagnostics",
    }
}

/// Pre-install diagnostics for a parameterless (package-manager) install: only what
/// this step is about to do. No argument or network checks — there are no tenant
/// parameters yet — and no WebView2, which moves to `auth` along with them.
pub fn run_preinstall_parameterless() -> DoctorReport {
    let mut results = Vec::new();

    results.push(check_admin_privileges());
    if results.last().unwrap().status == CheckStatus::Fail {
        return DoctorReport {
            results,
            title: "pre-install diagnostics",
        };
    }

    let dir_manager = DirectoryManager::new();
    let install_path = Service::get_install_location();
    let bin_dir = install_path.parent().unwrap_or(&install_path);
    results.push(check_dir_writable(bin_dir, &bin_dir.display().to_string()));
    results.push(check_disk_space(dir_manager.app_support_dir(), 200));

    for (path, label) in [
        (
            dir_manager.app_support_dir(),
            dir_manager
                .app_support_dir()
                .to_str()
                .unwrap_or("app support"),
        ),
        (
            dir_manager.secured_dir(),
            dir_manager.secured_dir().to_str().unwrap_or("secured"),
        ),
        (
            dir_manager.logs_dir(),
            dir_manager.logs_dir().to_str().unwrap_or("logs"),
        ),
    ] {
        results.push(check_dir_writable(path, label));
    }

    results.push(check_service_config_writable());

    DoctorReport {
        results,
        title: "pre-install diagnostics",
    }
}

/// Pre-auth validation: the params and the network they point at, checked while
/// the user is at the keyboard — nothing is written unless this passes.
pub async fn run_auth(params: &InstallConfigParams) -> DoctorReport {
    let mut results = Vec::new();

    results.push(check_required_args(params));
    if results.last().unwrap().status == CheckStatus::Fail {
        return DoctorReport {
            results,
            title: "authentication diagnostics",
        };
    }

    results.push(check_admin_privileges());
    if results.last().unwrap().status == CheckStatus::Fail {
        return DoctorReport {
            results,
            title: "authentication diagnostics",
        };
    }

    // The chat tool arrives right after registration, so its runtime is checked (and
    // healed) here rather than at install time, where no tools are provisioned yet.
    if let Some(webview2) = check_webview2_runtime() {
        results.push(webview2);
    }

    // Install may lie far in the past (golden image, pre-provisioned package), and tool
    // provisioning starts as soon as this succeeds.
    results.push(check_disk_space(
        DirectoryManager::new().app_support_dir(),
        200,
    ));

    let server_url = params.server_url.as_deref().unwrap_or_default();
    run_network_checks(&mut results, server_url).await;

    DoctorReport {
        results,
        title: "authentication diagnostics",
    }
}

/// Post-install health check. Reads config from disk, checks admin + network.
pub async fn run_healthcheck() -> DoctorReport {
    let mut results = Vec::new();

    results.push(check_admin_privileges());
    if results.last().unwrap().status == CheckStatus::Fail {
        return DoctorReport {
            results,
            title: "health check",
        };
    }

    if let Some(webview2) = check_webview2_runtime() {
        results.push(webview2);
    }

    let dir_manager = DirectoryManager::new();
    let config_path = dir_manager.secured_dir().join("initial_config.json");

    let server_url = match std::fs::read_to_string(&config_path) {
        Ok(json) => match serde_json::from_str::<serde_json::Value>(&json) {
            Ok(val) => {
                results.push(CheckResult::pass(
                    CheckCategory::Command,
                    "Config: initial_config.json loaded",
                ));
                match val["server_host"].as_str().filter(|s| !s.trim().is_empty()) {
                    Some(host) => host.to_string(),
                    None => {
                        results.push(CheckResult::fail(
                            CheckCategory::Command,
                            "Config: server_host",
                            format!(
                                "'server_host' missing or empty in {}",
                                config_path.display()
                            ),
                        ));
                        return DoctorReport {
                            results,
                            title: "health check",
                        };
                    }
                }
            }
            Err(_) => {
                results.push(CheckResult::fail(
                    CheckCategory::Command,
                    "Config: initial_config.json",
                    format!("Config file is corrupted: {}", config_path.display()),
                ));
                return DoctorReport {
                    results,
                    title: "health check",
                };
            }
        },
        Err(_) => {
            // Not an error: a parameterless install runs unauthenticated until
            // `openframe auth` writes the config.
            results.push(CheckResult::info(
                CheckCategory::Command,
                "Awaiting authentication — run 'openframe auth' with your tenant parameters to connect this device",
            ));
            return DoctorReport {
                results,
                title: "health check",
            };
        }
    };

    run_network_checks(&mut results, &server_url).await;

    DoctorReport {
        results,
        title: "health check",
    }
}

async fn run_network_checks(results: &mut Vec<CheckResult>, server_url: &str) {
    results.push(check_dns_resolve(server_url));
    if results.last().unwrap().status == CheckStatus::Fail {
        return;
    }

    results.push(check_tcp_connect(server_url));
    results.push(check_tls_handshake(server_url).await);
    results.push(check_websocket_upgrade(server_url).await);

    if let Some(proxy) = check_proxy_env() {
        results.push(proxy);
    }
}
