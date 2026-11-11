use std::path::Path;
use std::process::Stdio;

use tokio::process::Command;
use tokio::time::{timeout, Duration};

use super::job::JobHandle;
use super::Interpreter;
use crate::executor::env::apply_env_vars;
use crate::executor::output::{clean_string, join_reads, read_capped};
use crate::executor::{AgentFailure, ExecResult, ScriptParams};

const CREATE_NO_WINDOW: u32 = 0x0800_0000;
const READ_GRACE: Duration = Duration::from_secs(5);

pub(super) async fn run_normal(
    interpreter: &Interpreter,
    tmp_file: &Path,
    params: &ScriptParams<'_>,
) -> ExecResult {
    let mut cmd = Command::new(&interpreter.exe);
    for &flag in interpreter.flags {
        cmd.arg(flag);
    }
    cmd.arg(tmp_file);
    cmd.args(params.args);
    cmd.creation_flags(CREATE_NO_WINDOW);
    apply_env_vars(&mut cmd, params.env_vars);
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = match cmd.spawn() {
        Ok(child) => child,
        Err(e) => return ExecResult::not_launched(e.into()),
    };

    let pid = child.id().unwrap_or(0);
    let job = JobHandle::for_pid(pid);

    let stdout_task = tokio::spawn(read_capped(child.stdout.take()));
    let stderr_task = tokio::spawn(read_capped(child.stderr.take()));

    match timeout(
        Duration::from_secs(params.timeout_secs as u64),
        child.wait(),
    )
    .await
    {
        Ok(Ok(status)) => {
            let (out, err) =
                join_reads(stdout_task, stderr_task, READ_GRACE, || job.terminate()).await;
            ExecResult {
                stdout: clean_string(&out),
                stderr: clean_string(&err),
                retcode: status.code().unwrap_or(1),
                timed_out: false,
                agent_failure: None,
            }
        }
        Ok(Err(e)) => {
            let (out, err) =
                join_reads(stdout_task, stderr_task, READ_GRACE, || job.terminate()).await;
            ExecResult {
                stdout: clean_string(&out),
                stderr: format!("{}\n{}", clean_string(&err), e),
                retcode: 1,
                timed_out: false,
                agent_failure: Some(AgentFailure::CouldNotLaunch),
            }
        }
        Err(_) => {
            job.terminate();
            let _ = child.start_kill();
            let (out, err) =
                join_reads(stdout_task, stderr_task, READ_GRACE, || job.terminate()).await;
            let _ = child.wait().await;
            ExecResult {
                stdout: clean_string(&out),
                stderr: format!(
                    "{}\nScript timed out after {} seconds",
                    clean_string(&err),
                    params.timeout_secs
                ),
                retcode: 98,
                timed_out: true,
                agent_failure: None,
            }
        }
    }
}
