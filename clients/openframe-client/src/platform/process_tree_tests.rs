use super::*;

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
