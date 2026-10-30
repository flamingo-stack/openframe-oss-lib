use super::*;

#[test]
fn starts_unset_and_stays_set() {
    let latch = Latch::default();
    assert!(!latch.is_set());

    latch.set();
    latch.set();

    assert!(latch.is_set());
}

#[test]
fn clones_observe_the_same_latch() {
    let setter = Latch::default();
    let reader = setter.view();

    setter.set();

    assert!(reader.is_set());
}
