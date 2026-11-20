use std::io::Read;
use std::process::{Child, Command, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

use super::*;

const BOUND: Duration = Duration::from_secs(15);

fn long_running() -> Command {
    #[cfg(windows)]
    {
        let mut command = Command::new("ping");
        command.args(["-n", "60", "127.0.0.1"]);
        command
    }
    #[cfg(unix)]
    {
        let mut command = Command::new("sleep");
        command.arg("60");
        command
    }
}

fn parent_of_long_running() -> Command {
    #[cfg(windows)]
    {
        let mut command = Command::new("cmd");
        command.args(["/C", "ping -n 60 127.0.0.1"]);
        command
    }
    #[cfg(unix)]
    {
        let mut command = Command::new("sh");
        command.args(["-c", "sleep 60 & echo started; wait"]);
        command
    }
}

fn exits_within(mut child: Child, bound: Duration) -> bool {
    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        let _ = tx.send(child.wait());
    });
    matches!(rx.recv_timeout(bound), Ok(Ok(_)))
}

#[test]
fn terminate_kills_a_running_process() {
    let child = long_running()
        .stdout(Stdio::null())
        .spawn()
        .expect("spawn a long-running process");

    terminate(child.id()).expect("terminate the process");

    assert!(
        exits_within(child, BOUND),
        "the process should exit after terminate"
    );
}

#[cfg(windows)]
#[test]
fn terminate_returns_the_win32_error_for_a_process_it_cannot_kill() {
    const SYSTEM_PID: u32 = 4;

    let err = terminate(SYSTEM_PID).expect_err("the System process cannot be terminated");

    assert!(
        matches!(err.raw_os_error(), Some(code) if (1..=0xFFFF).contains(&code)),
        "expected a Win32 error code, got {err:?}"
    );
}

#[cfg(unix)]
#[test]
fn terminate_returns_the_os_error_for_a_process_that_is_gone() {
    let mut child = Command::new("true").spawn().expect("spawn true");
    let pid = child.id();
    child.wait().expect("reap true");

    let err = terminate(pid).expect_err("the process is gone");

    assert_eq!(err.raw_os_error(), Some(libc::ESRCH), "{err:?}");
}

#[test]
fn pid_zero_is_refused() {
    assert!(terminate(0).is_err());
    assert_eq!(
        terminate_tree(0).map_err(|e| e.kind()),
        Err(io::ErrorKind::InvalidInput)
    );
}

#[test]
fn terminate_tree_kills_the_process_and_its_descendants() {
    let mut root = parent_of_long_running()
        .stdout(Stdio::piped())
        .spawn()
        .expect("spawn a process with a long-running child");
    let mut stdout = root.stdout.take().expect("piped stdout");
    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        let mut first = [0u8; 1];
        let started = matches!(stdout.read(&mut first), Ok(n) if n > 0);
        let _ = tx.send(started);
        let _ = std::io::copy(&mut stdout, &mut std::io::sink());
        let _ = tx.send(true);
    });
    assert_eq!(
        rx.recv_timeout(BOUND),
        Ok(true),
        "the child should print once it runs"
    );

    terminate_tree(root.id()).expect("terminate the tree");

    assert!(
        rx.recv_timeout(BOUND).is_ok(),
        "stdout should close once the root and its child are gone"
    );
    let _ = root.wait();
}

#[test]
fn descendants_are_collected_transitively() {
    let links = vec![
        (1, None),
        (10, Some(1)),
        (11, Some(10)),
        (12, Some(11)),
        (13, Some(10)),
        (20, Some(1)),
    ];
    let mut found = descendants(&links, 10);
    found.sort();
    assert_eq!(found, vec![11, 12, 13]);
}

#[test]
fn descendants_of_a_leaf_are_empty() {
    let links = vec![(10, Some(1)), (11, Some(10))];
    assert!(descendants(&links, 11).is_empty());
}

#[test]
fn descendants_survive_a_parent_cycle() {
    let links = vec![(10, Some(11)), (11, Some(10))];
    assert_eq!(descendants(&links, 10), vec![11]);
}
