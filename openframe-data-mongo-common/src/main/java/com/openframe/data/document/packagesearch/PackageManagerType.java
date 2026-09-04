package com.openframe.data.document.packagesearch;

import com.openframe.data.document.rmm.script.OsType;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum PackageManagerType {
    BREW(OsType.MAC_OS),
    CHOCO(OsType.WINDOWS),
    WINGET(OsType.WINDOWS);

    private final OsType osType;
}
