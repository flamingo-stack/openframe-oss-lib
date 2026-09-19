package com.openframe.data.document.packagesearch;

import com.openframe.data.document.rmm.bootstrap.SystemScriptCode;

public enum PackageManagerType {
    BREW(SystemScriptCode.INSTALL_BREW),
    CHOCO(SystemScriptCode.INSTALL_CHOCOLATEY),
    WINGET(SystemScriptCode.INSTALL_WINGET);

    private final SystemScriptCode bootstrapScript;

    PackageManagerType(SystemScriptCode bootstrapScript) {
        this.bootstrapScript = bootstrapScript;
    }

    public SystemScriptCode bootstrapScript() {
        return bootstrapScript;
    }
}
