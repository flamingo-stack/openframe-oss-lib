package com.openframe.gateway.security.revocation;

import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

class RevokedKeyRegistryTest {

    private static final String REVOKED_KID = "kid-revoked";
    private static final String OTHER_KID = "kid-other";

    @Test
    void revokedKidIsReportedAndOtherKidIsNot() {
        // setup
        RevokedKeyRegistry registry = new RevokedKeyRegistry(Duration.ofHours(1));

        // execution
        registry.revoke(REVOKED_KID);

        // verifications
        assertThat(registry.isRevoked(REVOKED_KID)).isTrue();
        assertThat(registry.isRevoked(OTHER_KID)).isFalse();
    }

    @Test
    void revokedKidExpiresAfterTheTtl() {
        // setup
        RevokedKeyRegistry registry = new RevokedKeyRegistry(Duration.ofMillis(50));

        // execution
        registry.revoke(REVOKED_KID);

        // verifications
        await().atMost(Duration.ofSeconds(2)).until(() -> !registry.isRevoked(REVOKED_KID));
    }
}
