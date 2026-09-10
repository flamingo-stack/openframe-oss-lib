package com.openframe.data.document.rmm.software;

public enum SoftwareScriptCode {

    BREW_INSTALL("__software__brew-install"),
    BREW_UPDATE("__software__brew-update"),
    WINGET_INSTALL("__software__winget-install"),
    WINGET_UPDATE("__software__winget-update");

    private final String canonicalName;

    SoftwareScriptCode(String canonicalName) {
        this.canonicalName = canonicalName;
    }

    public String canonicalName() {
        return canonicalName;
    }
}
