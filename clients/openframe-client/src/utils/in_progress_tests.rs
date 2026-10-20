use super::*;

#[test]
fn idle_until_an_operation_begins() {
    let ops = InProgress::default();
    assert!(!ops.view().is_active());

    let guard = ops.begin();
    assert!(ops.view().is_active());

    drop(guard);
    assert!(!ops.view().is_active());
}

#[test]
fn active_while_any_overlapping_operation_runs() {
    let ops = InProgress::default();
    let first = ops.begin();
    let second = ops.begin();

    drop(first);
    assert!(ops.view().is_active());

    drop(second);
    assert!(!ops.view().is_active());
}

#[test]
fn clones_observe_the_same_operations() {
    let producer = InProgress::default();
    let reader = producer.view();

    let _guard = producer.begin();

    assert!(reader.is_active());
}

#[test]
fn a_panicking_operation_still_ends() {
    let ops = InProgress::default();
    let worker = ops.clone();

    let result = std::thread::spawn(move || {
        let _guard = worker.begin();
        panic!("upgrade blew up");
    })
    .join();

    assert!(result.is_err());
    assert!(!ops.view().is_active());
}
