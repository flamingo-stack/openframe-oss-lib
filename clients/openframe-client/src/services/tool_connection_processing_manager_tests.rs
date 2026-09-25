use super::*;

fn tool_with_args(agent_id_args: &[&str], run_args: &[&str]) -> InstalledTool {
    InstalledTool {
        tool_agent_id_command_args: agent_id_args.iter().map(|a| a.to_string()).collect(),
        run_command_args: run_args.iter().map(|a| a.to_string()).collect(),
        ..Default::default()
    }
}

#[test]
fn fleet_agent_id_command_launches_osqueryd() {
    let tool = tool_with_args(
        &[
            "uuid",
            "--openframe-mode",
            "--openframe-osquery-path",
            "${client.assetPath.osqueryd}",
        ],
        &[],
    );
    assert!(tool_launches_asset(&tool, OSQUERYD_ASSET_ID));
}

#[test]
fn run_command_placeholder_also_counts() {
    let tool = tool_with_args(&[], &["--osqueryd-path=${client.assetPath.osqueryd}"]);
    assert!(tool_launches_asset(&tool, OSQUERYD_ASSET_ID));
}

#[test]
fn tools_without_the_placeholder_are_skipped() {
    let mesh = tool_with_args(&["-nodeid-base64"], &["--openframe-mode"]);
    assert!(!tool_launches_asset(&mesh, OSQUERYD_ASSET_ID));
    let other_asset = tool_with_args(&["${client.assetPath.osqueryd-helper}"], &[]);
    assert!(!tool_launches_asset(&other_asset, OSQUERYD_ASSET_ID));
}

/// Reads the pid a test script wrote, waiting for the script to get there.
async fn read_pid_file(path: &std::path::Path) -> u32 {
    for _ in 0..100 {
        if let Ok(text) = std::fs::read_to_string(path) {
            if let Ok(pid) = text.trim().parse() {
                return pid;
            }
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    panic!("pid file {} was never written", path.display());
}

async fn wait_until_gone(pid: u32) -> bool {
    for _ in 0..40 {
        if !is_alive(pid) {
            return true;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    false
}

#[cfg(unix)]
fn is_alive(pid: u32) -> bool {
    unsafe { libc::kill(pid as i32, 0) == 0 }
}

#[cfg(windows)]
fn is_alive(pid: u32) -> bool {
    let mut sys = sysinfo::System::new();
    sys.refresh_process(sysinfo::Pid::from_u32(pid))
}

fn pid_file(name: &str) -> std::path::PathBuf {
    std::env::temp_dir().join(format!("{name}-{}", std::process::id()))
}

#[cfg(unix)]
#[tokio::test]
async fn agent_id_command_returns_output_when_it_finishes() {
    let args = vec![
        "-c".to_string(),
        "echo host-uuid; echo warn >&2".to_string(),
    ];
    let out = run_agent_id_command("/bin/sh", &args, Duration::from_secs(5))
        .await
        .unwrap()
        .expect("should finish before the timeout");
    assert!(out.status.success());
    assert_eq!(String::from_utf8_lossy(&out.stdout).trim(), "host-uuid");
    assert_eq!(String::from_utf8_lossy(&out.stderr).trim(), "warn");
}

#[cfg(unix)]
#[tokio::test]
async fn agent_id_command_timeout_kills_grandchildren() {
    let pid_file = pid_file("agentid-grandchild");
    let _ = std::fs::remove_file(&pid_file);
    let script = format!(
        "sleep 60 > /dev/null 2>&1 & echo $! > {}; wait",
        pid_file.display()
    );
    let args = vec!["-c".to_string(), script];

    let result = run_agent_id_command("/bin/sh", &args, Duration::from_secs(2))
        .await
        .unwrap();
    assert!(result.is_none(), "command should time out");

    let grandchild = read_pid_file(&pid_file).await;
    let _ = std::fs::remove_file(&pid_file);
    assert!(
        wait_until_gone(grandchild).await,
        "grandchild {grandchild} outlived the timed-out agentId command"
    );
}

#[cfg(unix)]
#[tokio::test]
async fn agent_id_command_stays_in_the_client_process_group() {
    let args = vec!["-c".to_string(), "ps -o pgid= -p $$".to_string()];
    let out = run_agent_id_command("/bin/sh", &args, Duration::from_secs(5))
        .await
        .unwrap()
        .expect("should finish before the timeout");
    let child_pgid: i32 = String::from_utf8_lossy(&out.stdout).trim().parse().unwrap();
    assert_eq!(child_pgid, unsafe { libc::getpgrp() });
}

#[cfg(windows)]
#[tokio::test]
async fn agent_id_command_timeout_kills_grandchildren() {
    let pid_file = pid_file("agentid-grandchild");
    let _ = std::fs::remove_file(&pid_file);
    let script = format!(
        "$p = Start-Process -FilePath ping.exe -ArgumentList '-n','120','127.0.0.1' -WindowStyle Hidden -PassThru; \
         Set-Content -Path '{}' -Value $p.Id; Start-Sleep -Seconds 120",
        pid_file.display()
    );
    let args = vec!["-NoProfile".to_string(), "-Command".to_string(), script];

    let result = run_agent_id_command("powershell.exe", &args, Duration::from_secs(20))
        .await
        .unwrap();
    assert!(result.is_none(), "command should time out");

    let grandchild = read_pid_file(&pid_file).await;
    let _ = std::fs::remove_file(&pid_file);
    assert!(
        wait_until_gone(grandchild).await,
        "grandchild {grandchild} outlived the timed-out agentId command"
    );
}
