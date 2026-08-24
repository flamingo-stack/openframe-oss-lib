package com.openframe.security.jwt;

import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

import lombok.Data;

@Data
public class KeyConfig {

    private String value;

    public RSAPublicKey toRSAPublicKey() {
        String publicKeyPEM = value
                .replace("-----BEGIN PUBLIC KEY-----", "")
                .replace("-----END PUBLIC KEY-----", "")
                .replaceAll("\\s", "");

        try {
            byte[] encoded = Base64.getDecoder().decode(publicKeyPEM);
            KeyFactory keyFactory = KeyFactory.getInstance("RSA");
            X509EncodedKeySpec keySpec = new X509EncodedKeySpec(encoded);
            return (RSAPublicKey) keyFactory.generatePublic(keySpec);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new InvalidPublicKeyException("Failed to parse RSA public key", e);
        }
    }

    public static class InvalidPublicKeyException extends RuntimeException {
        public InvalidPublicKeyException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
