package com.openframe.authz.keys;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;

/**
 * Value object holding generated RSA key material and PEM encodings.
 */
@Getter
@Builder
@AllArgsConstructor
public class AuthenticationKeyPair {
    private final RSAPublicKey publicKey;
    private final RSAPrivateKey privateKey;
    private final String publicPem;
    private final String privatePem;
    private final String kid;
}
