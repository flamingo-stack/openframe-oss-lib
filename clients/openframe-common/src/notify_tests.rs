use super::*;

#[test]
fn truncate_counts_characters_not_bytes() {
    assert_eq!(truncate("привіт світ", 11), "привіт світ");
    assert_eq!(truncate("привіт світ", 7), "привіт…");
}
