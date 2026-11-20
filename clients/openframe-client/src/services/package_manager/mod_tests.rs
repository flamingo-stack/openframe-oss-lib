use super::*;

#[test]
fn last_line_skips_trailing_blank_lines() {
    assert_eq!(last_line("one\ntwo\n\n  \n"), "two");
    assert_eq!(last_line(""), "");
}
