use super::*;

#[test]
fn serializes_valid_signature_with_signer() {
    let json = serde_json::to_value(CodeSignature::valid("F7LDSU8JPJ".to_string())).unwrap();
    assert_eq!(json["status"], "VALID");
    assert_eq!(json["signer"], "F7LDSU8JPJ");
}

#[test]
fn omits_signer_when_unsigned() {
    let json = serde_json::to_value(CodeSignature::unsigned()).unwrap();
    assert_eq!(json["status"], "UNSIGNED");
    assert!(json.get("signer").is_none());
}
