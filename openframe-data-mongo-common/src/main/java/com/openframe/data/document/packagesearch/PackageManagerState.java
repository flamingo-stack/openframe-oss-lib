package com.openframe.data.document.packagesearch;

import java.util.EnumSet;
import java.util.Set;

public enum PackageManagerState {
    PRESENT,
    MISSING,
    UNSUPPORTED,
    UNKNOWN;

    public static final Set<PackageManagerState> MANAGEABLE = EnumSet.of(PRESENT, MISSING, UNKNOWN);
}
