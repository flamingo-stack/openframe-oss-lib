package com.openframe.management.packagesearch;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
class WingetEntry {

    private final String id;
    private final String name;
    private final String moniker;
    private final String latestVersion;
    // first 8 hex chars of the package hash, lower-cased — a CDN path segment that 404s on upper-case
    private final String hashPrefix;
}
