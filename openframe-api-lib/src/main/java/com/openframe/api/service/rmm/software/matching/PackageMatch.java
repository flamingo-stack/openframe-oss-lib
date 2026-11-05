package com.openframe.api.service.rmm.software.matching;

import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class PackageMatch {

    private static final PackageMatch NO_PACKAGE = new PackageMatch(null, false);
    private static final PackageMatch AMBIGUOUS = new PackageMatch(null, true);

    private final PackageCatalogEntry entry;
    private final boolean candidatesFound;

    public static PackageMatch of(PackageCatalogEntry entry) {
        return new PackageMatch(entry, true);
    }

    public static PackageMatch noPackage() {
        return NO_PACKAGE;
    }

    // several unrelated packages answer the program: which one is not known
    public static PackageMatch ambiguous() {
        return AMBIGUOUS;
    }

    public boolean isMatched() {
        return entry != null;
    }

    public boolean hasNoPackage() {
        return !candidatesFound;
    }
}
