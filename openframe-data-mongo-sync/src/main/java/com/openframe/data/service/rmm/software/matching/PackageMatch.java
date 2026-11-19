package com.openframe.data.service.rmm.software.matching;

import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.rmm.software.PackageMatchState;
import com.openframe.data.document.rmm.software.SoftwarePackageMatch;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.Instant;

@Getter
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class PackageMatch {

    private static final PackageMatch NO_PACKAGE = new PackageMatch(null, false, null);
    private static final PackageMatch AMBIGUOUS = new PackageMatch(null, true, null);

    private final PackageCatalogEntry entry;
    private final boolean candidatesFound;
    private final PackageCatalogEntry bestCandidate;

    public static PackageMatch of(PackageCatalogEntry entry) {
        return new PackageMatch(entry, true, null);
    }

    public static PackageMatch noPackage() {
        return NO_PACKAGE;
    }

    // several unrelated packages answer the program: which one is not known
    public static PackageMatch ambiguous() {
        return AMBIGUOUS;
    }

    // the same, with the candidate that fits best: an adoption offers it to the admin instead of giving up
    public static PackageMatch ambiguous(PackageCatalogEntry bestCandidate) {
        return new PackageMatch(null, true, bestCandidate);
    }

    public PackageMatch orBestCandidate() {
        return bestCandidate == null ? this : of(bestCandidate);
    }

    public boolean isMatched() {
        return entry != null;
    }

    public boolean hasNoPackage() {
        return !candidatesFound;
    }

    public SoftwarePackageMatch toStored(Instant matchedAt) {
        if (isMatched()) {
            return new SoftwarePackageMatch(PackageMatchState.MATCHED, entry.getManager(), entry.getPackageId(), matchedAt);
        }
        return new SoftwarePackageMatch(hasNoPackage() ? PackageMatchState.NO_PACKAGE : PackageMatchState.AMBIGUOUS,
                null, null, matchedAt);
    }
}
