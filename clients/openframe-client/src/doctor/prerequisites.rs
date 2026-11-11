use std::fs::{File, OpenOptions, TryLockError};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

use super::checks::{check_dotnet_framework, check_webview2_runtime};
use super::healing::{self, HealOutcome, HealResult};
use super::{CheckResult, Remediation};
use crate::models::Feature;
use crate::platform::DirectoryManager;
use crate::services::feature_flags_service::FeatureFlagsService;
use crate::services::result_store::now_secs;
use crate::utils::fs::{atomic_write, read_json_or_quarantine, JsonFile};

const RECORD_FILE: &str = "runtime_prerequisites.json";
const FAILURES_BEFORE_DAILY: u32 = 3;
const DAILY_SECS: u64 = 24 * 60 * 60;
const MAX_START_DELAY_SECS: u64 = 15 * 60;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
struct Failures {
    count: u32,
    last_at: u64,
}

#[derive(Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
struct Record {
    #[serde(default)]
    webview2: Option<Failures>,
    #[serde(default)]
    dotnet48: Option<Failures>,
}

impl Record {
    fn slot(&mut self, remediation: Remediation) -> &mut Option<Failures> {
        match remediation {
            Remediation::InstallWebview2 => &mut self.webview2,
            Remediation::InstallDotnet48 => &mut self.dotnet48,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Caller {
    Command,
    Agent,
}

pub(crate) fn checks() -> Vec<CheckResult> {
    checks_for(saved_chocolatey_flag())
}

pub(crate) async fn heal(results: &[CheckResult]) -> Vec<HealResult> {
    if !saved_chocolatey_flag() {
        return healing::heal(results).await;
    }
    heal_recorded(
        &record_path(&DirectoryManager::new()),
        &healing::pending(results),
        Caller::Command,
    )
    .await
}

pub(crate) fn record_path(directory_manager: &DirectoryManager) -> PathBuf {
    directory_manager.secured_dir().join(RECORD_FILE)
}

pub(crate) async fn heal_on_start(path: PathBuf, chocolatey_enabled: bool) {
    if !chocolatey_enabled {
        return;
    }
    if !healing::leftover_installers().is_empty() {
        match lock(&path) {
            Ok(Some(_lock)) => remove_leftover_installers(),
            Ok(None) => {}
            Err(e) => warn!("Cannot remove leftover runtime installers: {:#}", e),
        }
    }
    if healing::pending(&checks_for(true)).is_empty() {
        return;
    }
    let delay = start_delay();
    info!(
        delay_secs = delay.as_secs(),
        "Runtime prerequisites missing, installing them after a random delay"
    );
    tokio::time::sleep(delay).await;
    heal_recorded(&path, &healing::pending(&checks_for(true)), Caller::Agent).await;
}

fn checks_for(chocolatey_enabled: bool) -> Vec<CheckResult> {
    let mut results: Vec<CheckResult> = check_webview2_runtime().into_iter().collect();
    if chocolatey_enabled {
        results.extend(check_dotnet_framework());
    }
    results
}

fn saved_chocolatey_flag() -> bool {
    FeatureFlagsService::load_saved(&DirectoryManager::new())
        .flags()
        .is_enabled(Feature::Chocolatey)
}

async fn heal_recorded(
    path: &Path,
    remediations: &[Remediation],
    caller: Caller,
) -> Vec<HealResult> {
    if remediations.is_empty() {
        return Vec::new();
    }
    let _lock = match lock(path) {
        Ok(Some(lock)) => lock,
        Ok(None) => {
            info!("Doctor healing: skipped, another OpenFrame process is installing");
            return each(remediations, || HealOutcome::StillRunning);
        }
        Err(e) => {
            warn!("Doctor healing: skipped: {:#}", e);
            return each(remediations, || HealOutcome::Failed(format!("{e:#}")));
        }
    };
    remove_leftover_installers();

    let mut heals = Vec::new();
    for &remediation in remediations {
        if healing::installer_running(remediation) {
            info!(
                ?remediation,
                "Doctor healing: skipped, its installer is still running"
            );
            heals.push(HealResult {
                remediation,
                outcome: HealOutcome::StillRunning,
            });
            continue;
        }
        let failures = match load(path) {
            Ok(mut record) => *record.slot(remediation),
            Err(e) => {
                warn!(?remediation, "Doctor healing: skipped: {:#}", e);
                heals.push(HealResult {
                    remediation,
                    outcome: HealOutcome::Failed(format!("{e:#}")),
                });
                continue;
            }
        };
        if caller == Caller::Agent && resting(failures, now_secs()) {
            info!(
                ?remediation,
                ?failures,
                "Doctor healing: skipped, failed too often today"
            );
            continue;
        }

        let heal = healing::heal_one(remediation).await;
        save(
            path,
            remediation,
            settled(failures, &heal.outcome, now_secs()),
        );
        heals.push(heal);
    }
    heals
}

fn each(remediations: &[Remediation], outcome: impl Fn() -> HealOutcome) -> Vec<HealResult> {
    remediations
        .iter()
        .map(|&remediation| HealResult {
            remediation,
            outcome: outcome(),
        })
        .collect()
}

fn lock(path: &Path) -> Result<Option<File>> {
    let lock_path = path.with_extension("lock");
    if let Some(parent) = lock_path.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("cannot create {}", parent.display()))?;
    }
    let file = OpenOptions::new()
        .create(true)
        .truncate(false)
        .write(true)
        .open(&lock_path)
        .with_context(|| format!("cannot open {}", lock_path.display()))?;
    match file.try_lock() {
        Ok(()) => Ok(Some(file)),
        Err(TryLockError::WouldBlock) => Ok(None),
        Err(TryLockError::Error(e)) => {
            Err(e).with_context(|| format!("cannot lock {}", lock_path.display()))
        }
    }
}

fn remove_leftover_installers() {
    for leftover in healing::leftover_installers() {
        match std::fs::remove_file(&leftover) {
            Ok(()) => info!(path = %leftover.display(), "Removed a leftover runtime installer"),
            Err(e) => info!(path = %leftover.display(), "Leftover runtime installer kept: {}", e),
        }
    }
}

fn resting(failures: Option<Failures>, now: u64) -> bool {
    failures.is_some_and(|failures| {
        failures.count >= FAILURES_BEFORE_DAILY
            && now
                .checked_sub(failures.last_at)
                .is_some_and(|age| age < DAILY_SECS)
    })
}

fn settled(failures: Option<Failures>, outcome: &HealOutcome, now: u64) -> Option<Failures> {
    match outcome {
        HealOutcome::Healed | HealOutcome::RestartRequired => None,
        HealOutcome::StillRunning => failures,
        HealOutcome::Failed(_) => Some(Failures {
            count: failures
                .map_or(0, |failures| failures.count)
                .saturating_add(1),
            last_at: now,
        }),
    }
}

fn load(path: &Path) -> Result<Record> {
    match read_json_or_quarantine(path).context("cannot read the runtime install record")? {
        JsonFile::Parsed(record) => Ok(record),
        JsonFile::Missing | JsonFile::Corrupt => Ok(Record::default()),
    }
}

fn save(path: &Path, remediation: Remediation, failures: Option<Failures>) {
    let saved = load(path).and_then(|mut record| {
        *record.slot(remediation) = failures;
        atomic_write(path, serde_json::to_vec_pretty(&record)?)
    });
    if let Err(e) = saved {
        warn!(path = %path.display(), ?remediation, "Failed to record the runtime install result: {:#}", e);
    }
}

fn start_delay() -> Duration {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| u64::from(elapsed.subsec_nanos()));
    Duration::from_secs(nanos % (MAX_START_DELAY_SECS + 1))
}

#[cfg(test)]
#[path = "prerequisites_tests.rs"]
mod tests;
