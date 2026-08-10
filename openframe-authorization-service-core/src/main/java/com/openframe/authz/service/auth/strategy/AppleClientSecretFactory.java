package com.openframe.authz.service.auth.strategy;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.ECDSASigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.springframework.stereotype.Component;

import java.security.KeyFactory;
import java.security.interfaces.ECPrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;

/**
 * Mints Apple {@code client_secret} JWTs: ES256, signed with the team's .p8 key,
 * {@code iss} = team ID, {@code sub} = the client id the secret is for. The same team key signs
 * secrets for every client id of the team — the web Services ID and the native app bundle ids —
 * so the web and native flows share one key and differ only in {@code sub}.
 */
@Component
public class AppleClientSecretFactory {

    public static final String APPLE_ISSUER = "https://appleid.apple.com";
    /** Apple caps the client-secret JWT at 6 months; secrets are minted per request, so keep it short. */
    private static final Duration CLIENT_SECRET_TTL = Duration.ofMinutes(5);

    public String mint(String teamId, String keyId, String privateKeyPem, String clientId) {
        if (teamId == null || teamId.isBlank() || keyId == null || keyId.isBlank()) {
            throw new IllegalArgumentException(
                    "Apple SSO config is missing teamId or keyId; both are required to build the client secret JWT.");
        }
        try {
            Instant now = Instant.now();
            JWTClaimsSet claims = new JWTClaimsSet.Builder()
                    .issuer(teamId)
                    .subject(clientId)
                    .audience(APPLE_ISSUER)
                    .issueTime(Date.from(now))
                    .expirationTime(Date.from(now.plus(CLIENT_SECRET_TTL)))
                    .build();
            SignedJWT jwt = new SignedJWT(
                    new JWSHeader.Builder(JWSAlgorithm.ES256).keyID(keyId).build(),
                    claims);
            jwt.sign(new ECDSASigner(parseEcPrivateKey(privateKeyPem)));
            return jwt.serialize();
        } catch (Exception e) {
            throw new IllegalStateException("Failed to build Apple client secret JWT: " + e.getMessage(), e);
        }
    }

    /**
     * Accepts the .p8 as downloaded (PKCS#8 PEM), with or without literal {@code \n} escapes —
     * the key often travels through an env var that flattens newlines.
     */
    private static ECPrivateKey parseEcPrivateKey(String pem) throws Exception {
        String base64 = pem
                .replace("\\n", "\n")
                .replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replaceAll("\\s", "");
        byte[] der = Base64.getDecoder().decode(base64);
        return (ECPrivateKey) KeyFactory.getInstance("EC").generatePrivate(new PKCS8EncodedKeySpec(der));
    }
}
