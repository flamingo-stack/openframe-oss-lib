package com.openframe.data.service.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdate;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class OsUpdateReleasedAtResolverTest {

    private static final Instant PUBLISHED_AT = Instant.parse("2026-10-13T17:00:00Z");
    private static final Instant FIRST_SEEN_AT = Instant.parse("2026-10-14T09:00:00Z");

    private final OsUpdateReleasedAtResolver osUpdateReleasedAtResolver = new OsUpdateReleasedAtResolver();

    @Test
    void resolve_updateTheVendorDated_theVendorsDate() {
        // setup
        OsUpdate osUpdate = OsUpdate.builder().publishedAt(PUBLISHED_AT).firstSeenAt(FIRST_SEEN_AT).build();

        // execution, verifications
        assertThat(osUpdateReleasedAtResolver.resolve(osUpdate)).isEqualTo(PUBLISHED_AT);
    }

    @Test
    void resolve_updateTheVendorDidNotDate_theFirstReportOfItInTheTenant() {
        // setup
        OsUpdate osUpdate = OsUpdate.builder().firstSeenAt(FIRST_SEEN_AT).build();

        // execution, verifications
        assertThat(osUpdateReleasedAtResolver.resolve(osUpdate)).isEqualTo(FIRST_SEEN_AT);
    }
}
