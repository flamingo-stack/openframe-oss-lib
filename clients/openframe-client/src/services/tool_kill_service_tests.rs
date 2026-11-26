use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

use super::*;

const BOUND: Duration = Duration::from_secs(30);
const HELPER: &str = "services::tool_kill_service::tests::sleeping_helper";
const TOOL: &str = "kill-test-tool";

fn tools() -> PathBuf {
    PathBuf::from(if cfg!(windows) {
        r"c:\openframe"
    } else {
        "/openframe"
    })
}

#[test]
fn an_image_under_a_folder_target_runs_from_it() {
    let folder = tools().join("fleetmdm-agent");
    assert!(runs_from(&folder.join("agent"), &folder));
    assert!(runs_from(&folder.join("bin").join("osqueryd"), &folder));
}

#[test]
fn a_sibling_folder_sharing_the_prefix_does_not_run_from_the_target() {
    let folder = tools().join("fleetmdm-agent");
    assert!(!runs_from(
        &tools().join("fleetmdm-agent-backup").join("agent"),
        &folder
    ));
}

#[test]
fn an_exe_target_matches_itself_and_its_aside_copy_only() {
    let agent = tools().join("fleetmdm-agent").join("agent");
    assert!(runs_from(&agent, &agent));
    assert!(runs_from(&aside_path(&agent), &agent));
    assert!(!runs_from(
        &tools().join("fleetmdm-agent").join("agent.backup"),
        &agent
    ));
}

#[test]
fn a_relative_target_matches_the_last_path_components() {
    let target = ToolKillService::relative_agent_path("fleetmdm-agent");
    let agent = tools().join(&target);
    assert!(runs_from(&agent, &target));
    assert!(runs_from(&aside_path(&agent), &target));
    assert!(!runs_from(
        &tools()
            .join("old-fleetmdm-agent")
            .join(target.file_name().unwrap()),
        &target
    ));
}

#[test]
fn the_image_is_the_executable_and_falls_back_to_argv0_only() {
    let exe = tools().join("fleetmdm-agent").join("agent");
    assert_eq!(
        process_image(Some(&exe), Some("grep")),
        Some(normalize(&exe))
    );
    assert_eq!(
        process_image(None, Some(&exe.to_string_lossy())),
        Some(normalize(&exe))
    );
    assert_eq!(process_image(None, None), None);
}

#[cfg(windows)]
#[test]
fn windows_paths_match_across_case_separators_and_the_verbatim_prefix() {
    let image = process_image(
        Some(Path::new(
            r"\\?\C:\ProgramData\OpenFrame\FleetMDM-Agent\Agent.exe",
        )),
        None,
    )
    .unwrap();
    assert!(runs_from(
        &image,
        &normalize(Path::new(r"C:\programdata\openframe\fleetmdm-agent"))
    ));
    assert!(runs_from(
        &image,
        &normalize(Path::new("C:/ProgramData/OpenFrame/fleetmdm-agent"))
    ));
    assert!(runs_from(
        &image,
        &normalize(&ToolKillService::relative_agent_path("fleetmdm-agent"))
    ));
}

#[test]
fn this_process_is_never_a_match() {
    let own = Pid::from_u32(std::process::id());
    let matches = ToolKillService::collect_matching_processes(&[std::env::current_exe().unwrap()]);
    assert!(!matches.iter().any(|(pid, _)| *pid == own));
}

#[test]
#[ignore = "helper process spawned by stopping_a_tool_folder_spares_processes_that_only_name_it"]
fn sleeping_helper() {
    thread::sleep(Duration::from_secs(60));
}

struct Helper {
    pid: u32,
    exited: mpsc::Receiver<()>,
}

impl Helper {
    fn start(exe: &Path, extra_arg: Option<&Path>) -> Self {
        let mut child = Command::new(exe)
            .args(["--ignored", "--exact", HELPER])
            .args(extra_arg)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("spawn the helper");
        let pid = child.id();
        let (tx, exited) = mpsc::channel();
        thread::spawn(move || {
            let _ = child.wait();
            let _ = tx.send(());
        });
        Self { pid, exited }
    }

    fn running(&self) -> bool {
        matches!(self.exited.try_recv(), Err(mpsc::TryRecvError::Empty))
    }

    fn stop(&self) {
        if self.running() {
            let _ = process_kill::terminate(self.pid);
            let _ = self.exited.recv_timeout(BOUND);
        }
    }
}

fn place_test_binary(dest: &Path) {
    std::fs::create_dir_all(dest.parent().unwrap()).unwrap();
    std::fs::copy(std::env::current_exe().unwrap(), dest).unwrap();
}

#[tokio::test]
async fn stopping_a_tool_folder_spares_processes_that_only_name_it() {
    let dir = tempfile::tempdir().unwrap();
    let agent = dir.path().join(ToolKillService::relative_agent_path(TOOL));
    let sibling = dir
        .path()
        .join(ToolKillService::relative_agent_path(&format!(
            "{TOOL}-backup"
        )));
    let tool_dir = agent.parent().unwrap().to_path_buf();
    place_test_binary(&agent);
    place_test_binary(&sibling);

    let tool = Helper::start(&agent, None);
    let neighbour = Helper::start(&sibling, None);
    let bystander = Helper::start(&std::env::current_exe().unwrap(), Some(&tool_dir));

    let stopped = ToolKillService::new()
        .stop_tool_by_path(&tool_dir.to_string_lossy())
        .await;
    let tool_exited = tool.exited.recv_timeout(BOUND).is_ok();
    let neighbour_running = neighbour.running();
    let bystander_running = bystander.running();
    for helper in [&tool, &neighbour, &bystander] {
        helper.stop();
    }

    stopped.expect("stop the processes under the tool folder");
    assert!(
        tool_exited,
        "the process running from the tool folder should be stopped"
    );
    assert!(
        neighbour_running,
        "a process running from a sibling folder was stopped"
    );
    assert!(
        bystander_running,
        "a process that only names the tool folder in its arguments was stopped"
    );
}
