package com.openframe.data.document.packagesearch;

import com.openframe.data.document.rmm.bootstrap.SystemScriptCode;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum PackageManagerDependency {

    WINGET_CLIENT_MODULE(PackageManagerType.WINGET, SystemScriptCode.INSTALL_WINGET_CLIENT_MODULE);

    private final PackageManagerType manager;
    private final SystemScriptCode bootstrapScript;
}
