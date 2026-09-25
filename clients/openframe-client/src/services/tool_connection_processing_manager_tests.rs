use super::*;

fn is_alive(pid: i32) -> bool {
    unsafe { libc::kill(pid, 0) == 0 }
}

#[tokio::test]
async fn agent_id_command_returns_output_when_it_finishes() {
    let args = vec!["-c".to_string(), "echo host-uuid".to_string()];
    let out = run_agent_id_command("/bin/sh", &args, Duration::from_secs(5))
        .await
        .unwrap()
        .expect("should finish before the timeout");
    assert!(out.status.success());
    assert_eq!(String::from_utf8_lossy(&out.stdout).trim(), "host-uuid");
}

#[tokio::test]
async fn agent_id_command_timeout_kills_grandchildren() {
    let pid_file = std::env::temp_dir().join(format!("agentid-grandchild-{}", std::process::id()));
    let script = format!(
        "sleep 60 > /dev/null 2>&1 & echo $! > {}; wait",
        pid_file.display()
    );
    let args = vec!["-c".to_string(), script];

    let result = run_agent_id_command("/bin/sh", &args, Duration::from_secs(1))
        .await
        .unwrap();
    assert!(result.is_none(), "command should time out");

    let grandchild: i32 = std::fs::read_to_string(&pid_file)
        .unwrap()
        .trim()
        .parse()
        .unwrap();
    let _ = std::fs::remove_file(&pid_file);

    let mut alive = true;
    for _ in 0..40 {
        alive = is_alive(grandchild);
        if !alive {
            break;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    assert!(
        !alive,
        "grandchild {grandchild} outlived the timed-out agentId command"
    );
}
