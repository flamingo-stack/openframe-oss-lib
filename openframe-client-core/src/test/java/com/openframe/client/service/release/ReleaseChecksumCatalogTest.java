package com.openframe.client.service.release;

import com.openframe.client.service.release.model.ReleaseBinaryChecksums;
import com.openframe.client.service.release.model.ReleaseChecksumLookup;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;

import static com.openframe.client.service.release.model.ReleaseChecksumLookupStatus.FOUND;
import static com.openframe.client.service.release.model.ReleaseChecksumLookupStatus.NOT_PUBLISHED;
import static com.openframe.client.service.release.model.ReleaseChecksumLookupStatus.UNAVAILABLE;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReleaseChecksumCatalogTest {

    private static final String VERSION = "1.5.74";
    private static final Instant NOW = Instant.parse("2026-10-20T10:00:00Z");

    @Mock
    private GitHubReleaseChecksumClient checksumClient;

    private MutableClock clock;
    private ReleaseChecksumCatalog catalog;

    @BeforeEach
    void setUp() {
        clock = new MutableClock(NOW);
        catalog = new ReleaseChecksumCatalog(checksumClient, clock);
    }

    @Test
    void lookup_KeepsPublishedChecksums() {
        ReleaseBinaryChecksums checksums = new ReleaseBinaryChecksums();
        checksums.setBinaries(Map.of("MAC_OS", "abc"));
        ReleaseChecksumLookup found = ReleaseChecksumLookup.found(checksums);
        when(checksumClient.fetch(VERSION)).thenReturn(found);

        catalog.lookup(VERSION);
        clock.advance(Duration.ofDays(30));
        ReleaseChecksumLookup lookup = catalog.lookup(VERSION);

        assertEquals(FOUND, lookup.getStatus());
        verify(checksumClient, times(1)).fetch(VERSION);
    }

    @Test
    void lookup_AsksAgainForUnpublishedVersionAfterRetryInterval() {
        ReleaseChecksumLookup notPublished = ReleaseChecksumLookup.notPublished();
        when(checksumClient.fetch(VERSION)).thenReturn(notPublished);

        catalog.lookup(VERSION);
        clock.advance(Duration.ofMinutes(1));
        ReleaseChecksumLookup cached = catalog.lookup(VERSION);
        clock.advance(Duration.ofMinutes(5));
        catalog.lookup(VERSION);

        assertEquals(NOT_PUBLISHED, cached.getStatus());
        verify(checksumClient, times(2)).fetch(VERSION);
    }

    @Test
    void lookup_DoesNotKeepUnavailableResult() {
        ReleaseChecksumLookup unavailable = ReleaseChecksumLookup.unavailable();
        when(checksumClient.fetch(VERSION)).thenReturn(unavailable);

        catalog.lookup(VERSION);
        ReleaseChecksumLookup lookup = catalog.lookup(VERSION);

        assertEquals(UNAVAILABLE, lookup.getStatus());
        verify(checksumClient, times(2)).fetch(VERSION);
    }

    private static final class MutableClock extends Clock {

        private Instant now;

        private MutableClock(Instant now) {
            this.now = now;
        }

        private void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
