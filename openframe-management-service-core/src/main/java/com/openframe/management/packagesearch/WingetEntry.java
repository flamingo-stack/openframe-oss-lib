package com.openframe.management.packagesearch;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
class WingetEntry {

    private final String id;
    private final String name;
    private final String moniker;
    private final String latestVersion;
    private final String latestDisplayVersion;
    // first 8 hex chars of the package hash, lower-cased — a CDN path segment that 404s on upper-case
    private final String hashPrefix;
    private final List<String> productCodes;
    private final List<String> upgradeCodes;
    private final List<String> normalizedNames;
    private final List<String> normalizedPublishers;
}
