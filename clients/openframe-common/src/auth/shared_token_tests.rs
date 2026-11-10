use super::*;

const DEPLOYED_FORMAT_CIPHERTEXT: &str =
    "EwCjbTco/441ksHsFzmFlUSR/Ulg3cEI2WqcDdiUP93ehIkT9A4C5Vap7BgV8AOP14PENg==";

#[test]
fn decrypts_the_format_deployed_agents_write() {
    assert_eq!(
        decrypt(KEY.as_bytes(), DEPLOYED_FORMAT_CIPHERTEXT).unwrap(),
        "header.payload.signature"
    );
}

#[test]
fn encrypts_to_base64_of_nonce_ciphertext_and_tag() {
    let plaintext = "header.payload.signature";
    let encrypted = encrypt(KEY.as_bytes(), plaintext).unwrap();

    let raw = general_purpose::STANDARD.decode(&encrypted).unwrap();
    assert_eq!(raw.len(), NONCE_LEN + plaintext.len() + 16);
    assert_eq!(decrypt(KEY.as_bytes(), &encrypted).unwrap(), plaintext);
}
