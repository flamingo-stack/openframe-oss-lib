package com.openframe.authz.keys;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.SecureRandom;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class RsaAuthenticationKeyPairGenerator implements AuthenticationKeyPairGenerator {

    private static final String KID_PREFIX = "kid-";

    private final KeyGeneratorProperties properties;

    @Override
    public AuthenticationKeyPair generate() {
        try {
            SecureRandom secureRandom = SecureRandom.getInstance(properties.getSecureRandomAlgorithm());
            KeyPairGenerator kpg = KeyPairGenerator.getInstance(properties.getAlgorithm());
            kpg.initialize(properties.getKeySize(), secureRandom);
            KeyPair kp = kpg.generateKeyPair();
            RSAPublicKey pub = (RSAPublicKey) kp.getPublic();
            RSAPrivateKey priv = (RSAPrivateKey) kp.getPrivate();
            String publicPem = PemUtil.toPublicPem(pub);
            String privatePem = PemUtil.toPrivatePem(priv);
            String kid = KID_PREFIX + UUID.randomUUID();
            return new AuthenticationKeyPair(pub, priv, publicPem, privatePem, kid);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to generate RSA key pair", e);
        }
    }
}


