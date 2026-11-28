package com.openframe.gateway.security.revocation;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Signing key ids this pod no longer trusts, filled by the platform's revocation events. Entries outlive the
 * decoder cache, by which time the issuer's JWKS no longer carries the kid; empty unless something revokes.
 */
@Component
public class RevokedKeyRegistry {

    private static final long MAX_ENTRIES = 10_000;

    private final Cache<String, Boolean> revoked;

    public RevokedKeyRegistry(@Value("${openframe.security.jwt.revoked-keys.ttl:PT1H}") Duration ttl) {
        this.revoked = Caffeine.newBuilder().expireAfterWrite(ttl).maximumSize(MAX_ENTRIES).build();
    }

    public void revoke(String kid) {
        revoked.put(kid, Boolean.TRUE);
    }

    public boolean isRevoked(String kid) {
        return kid != null && revoked.getIfPresent(kid) != null;
    }
}
