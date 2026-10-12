use super::ToolOps;
use futures::{poll, FutureExt};
use std::task::Poll;
use std::time::Duration;
use tokio::sync::oneshot;
use tokio::time::timeout;

const TOOL: &str = "tool-a";
const WAIT: Duration = Duration::from_secs(5);

fn assert_idle(ops: &ToolOps, tool: &str) {
    assert!(!ops.is_busy(tool));
    assert!(ops.try_lock(tool).is_ok());
}

#[tokio::test]
async fn marked_op_is_busy_until_dropped() {
    let ops = ToolOps::default();
    let op = ops.lock(TOOL).await.mark_busy();
    assert!(ops.is_busy(TOOL));

    drop(op);
    assert_idle(&ops, TOOL);
}

#[tokio::test]
async fn held_lock_makes_try_lock_busy() {
    let ops = ToolOps::default();

    let lock = ops.try_lock(TOOL).expect("free tool");
    assert!(ops.try_lock(TOOL).is_err());
    let op = lock.mark_busy();
    assert!(ops.try_lock(TOOL).is_err());

    drop(op);
    assert!(ops.try_lock(TOOL).is_ok());
}

#[tokio::test]
async fn locks_are_per_tool() {
    let ops = ToolOps::default();
    let _op = ops.lock(TOOL).await.mark_busy();

    assert!(ops.try_lock("tool-b").is_ok());
    assert!(!ops.is_busy("tool-b"));
}

#[tokio::test]
async fn any_busy_follows_every_tool() {
    let ops = ToolOps::default();
    assert!(!ops.any_busy());

    let a = ops.lock(TOOL).await.mark_busy();
    let b = ops.lock("tool-b").await.mark_busy();
    drop(a);
    assert!(ops.any_busy());

    drop(b);
    assert!(!ops.any_busy());
}

#[tokio::test]
async fn waiting_lock_sees_the_flag_cleared() {
    let ops = ToolOps::default();
    let op = ops.lock(TOOL).await.mark_busy();

    let next = ops.lock(TOOL);
    tokio::pin!(next);
    assert!(matches!(poll!(&mut next), Poll::Pending));

    drop(op);
    let _lock = timeout(WAIT, next).await.expect("lock released");
    assert!(!ops.is_busy(TOOL));
}

#[tokio::test]
async fn finished_op_is_released_once() {
    let ops = ToolOps::default();
    assert!(!ops.is_released(TOOL));

    drop(ops.lock(TOOL).await.mark_busy());
    assert!(ops.is_released(TOOL));
    assert!(ops.take_released(TOOL));
    assert!(!ops.take_released(TOOL));
}

#[tokio::test]
async fn unmarked_lock_is_neither_busy_nor_released() {
    let ops = ToolOps::default();

    drop(ops.lock(TOOL).await);
    assert!(!ops.is_released(TOOL));
    assert_idle(&ops, TOOL);
}

#[tokio::test]
async fn cancelled_op_clears_the_flag() {
    let ops = ToolOps::default();
    let (started_tx, started_rx) = oneshot::channel();
    let task = tokio::spawn({
        let ops = ops.clone();
        async move {
            let _op = ops.lock(TOOL).await.mark_busy();
            let _ = started_tx.send(());
            std::future::pending::<()>().await;
        }
    });
    timeout(WAIT, started_rx)
        .await
        .expect("op started")
        .expect("task alive");
    assert!(ops.is_busy(TOOL));

    task.abort();
    let joined = timeout(WAIT, task).await.expect("task stopped");
    assert!(joined.unwrap_err().is_cancelled());
    assert_idle(&ops, TOOL);
}

#[tokio::test]
async fn panicked_op_clears_the_flag() {
    let ops = ToolOps::default();
    let task = tokio::spawn({
        let ops = ops.clone();
        async move {
            let _op = ops.lock(TOOL).await.mark_busy();
            panic!("op failed");
        }
    });

    let joined = timeout(WAIT, task).await.expect("task stopped");
    assert!(joined.unwrap_err().is_panic());
    assert_idle(&ops, TOOL);
}

#[test]
fn op_dropped_outside_the_runtime_clears_the_flag() {
    let ops = ToolOps::default();
    let op = ops
        .lock(TOOL)
        .now_or_never()
        .expect("free tool")
        .mark_busy();

    std::thread::spawn(move || drop(op))
        .join()
        .expect("drop thread");
    assert!(!ops.is_busy(TOOL));
    assert!(ops.try_lock(TOOL).is_ok());
}
