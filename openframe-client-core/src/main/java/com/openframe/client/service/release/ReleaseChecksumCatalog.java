package com.openframe.client.service.release;

import com.openframe.client.service.release.model.ReleaseBinaryChecksums;
import com.openframe.client.service.release.model.ReleaseChecksumLookup;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ReleaseChecksumCatalog {

    // a version missing now is asked for again later, so a release published after a registration is picked up without a restart
    private static final Duration NOT_PUBLISHED_RETRY_INTERVAL = Duration.ofMinutes(5);

    private final GitHubReleaseChecksumClient checksumClient;
    private final Clock clock;
    // a published release never changes, so its checksums are kept for the life of the pod
    private final Map<String, ReleaseChecksumLookup> published = new ConcurrentHashMap<>();
    private final Map<String, Instant> notPublishedUntil = new ConcurrentHashMap<>();

    @Autowired
    public ReleaseChecksumCatalog(GitHubReleaseChecksumClient checksumClient) {
        this(checksumClient, Clock.systemUTC());
    }

    ReleaseChecksumCatalog(GitHubReleaseChecksumClient checksumClient, Clock clock) {
        this.checksumClient = checksumClient;
        this.clock = clock;
    }

    public ReleaseChecksumLookup lookup(String version) {
        if (published.containsKey(version)) {
            return published.get(version);
        }
        if (isRecentlyNotPublished(version)) {
            return ReleaseChecksumLookup.notPublished();
        }
        ReleaseChecksumLookup lookup = checksumClient.fetch(version);
        remember(version, lookup);
        return lookup;
    }

    private boolean isRecentlyNotPublished(String version) {
        Instant retryAt = notPublishedUntil.get(version);
        Instant now = clock.instant();
        return retryAt != null && now.isBefore(retryAt);
    }

    private void remember(String version, ReleaseChecksumLookup lookup) {
        switch (lookup.getStatus()) {
            case FOUND -> published.put(version, lookup);
            case NOT_PUBLISHED -> rememberNotPublished(version);
            case UNAVAILABLE -> notPublishedUntil.remove(version);
        }
    }

    private void rememberNotPublished(String version) {
        Instant now = clock.instant();
        Instant retryAt = now.plus(NOT_PUBLISHED_RETRY_INTERVAL);
        notPublishedUntil.put(version, retryAt);
    }
}
