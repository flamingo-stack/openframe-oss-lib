package com.openframe.client.service.release.model;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.Map;

import static com.openframe.client.service.release.model.ReleaseChecksumLookupStatus.FOUND;
import static com.openframe.client.service.release.model.ReleaseChecksumLookupStatus.NOT_PUBLISHED;
import static com.openframe.client.service.release.model.ReleaseChecksumLookupStatus.UNAVAILABLE;

@Getter
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class ReleaseChecksumLookup {

    private final ReleaseChecksumLookupStatus status;
    private final Map<String, String> binaries;

    public static ReleaseChecksumLookup found(ReleaseBinaryChecksums checksums) {
        Map<String, String> binaries = checksums.getBinaries();
        return new ReleaseChecksumLookup(FOUND, binaries);
    }

    public static ReleaseChecksumLookup notPublished() {
        return new ReleaseChecksumLookup(NOT_PUBLISHED, Map.of());
    }

    public static ReleaseChecksumLookup unavailable() {
        return new ReleaseChecksumLookup(UNAVAILABLE, Map.of());
    }
}
