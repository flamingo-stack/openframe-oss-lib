use super::*;
use std::path::Path;
use std::process::{Child, Command, Stdio};

/// A long-running copy of a system binary, started from `dir`; killed and reaped on drop.
struct RunningFrom(Child);

impl RunningFrom {
    #[cfg(target_os = "windows")]
    fn start(dir: &Path) -> Self {
        let system_root = std::env::var("SystemRoot").unwrap_or_else(|_| r"C:\Windows".into());
        let image = dir.join(IMAGE);
        std::fs::copy(Path::new(&system_root).join(r"System32\PING.EXE"), &image).unwrap();
        Self::spawn(Command::new(&image).args(["-n", "60", "127.0.0.1"]))
    }

    #[cfg(not(target_os = "windows"))]
    fn start(dir: &Path) -> Self {
        let image = dir.join(IMAGE);
        std::fs::copy("/bin/sleep", &image).unwrap();
        Self::spawn(Command::new(&image).arg("60"))
    }

    fn spawn(command: &mut Command) -> Self {
        RunningFrom(command.stdout(Stdio::null()).spawn().unwrap())
    }
}

impl Drop for RunningFrom {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

#[cfg(target_os = "windows")]
const IMAGE: &str = "held.exe";
#[cfg(not(target_os = "windows"))]
const IMAGE: &str = "held";

fn identity_for(install_dir: &Path) -> Result<AppIdentity, Undetermined> {
    Ok(AppIdentity::App {
        install_dir: install_dir.to_path_buf(),
        main_images: MainImages::Derived(vec![IMAGE.to_string()]),
    })
}

#[tokio::test]
async fn check_answers_from_a_fresh_snapshot() {
    let dir = tempfile::tempdir().unwrap();
    let identity = identity_for(dir.path());
    assert_eq!(check(&identity, &snapshot().await), GateDecision::Clear);

    let running = RunningFrom::start(dir.path());
    match check(&identity, &snapshot().await) {
        GateDecision::Blocked(BlockReason::Running { holders }) => {
            assert_eq!(holders.len(), 1);
            assert_eq!(holders[0].pid, running.0.id());
        }
        other => panic!("expected the app started after resolve to block, got {other:?}"),
    }

    drop(running);
    assert_eq!(check(&identity, &snapshot().await), GateDecision::Clear);
}
