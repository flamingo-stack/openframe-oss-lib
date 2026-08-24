package com.openframe.authz.keys;

import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * Value object holding generated RSA key material and PEM encodings.
 */
@Getter
@AllArgsConstructor
public class AuthenticationKeyPair {
    private final RSAPublicKey publicKey;
    private final RSAPrivateKey privateKey;
    private final String publicPem;
    private final String privatePem;
    private final String kid;
}


