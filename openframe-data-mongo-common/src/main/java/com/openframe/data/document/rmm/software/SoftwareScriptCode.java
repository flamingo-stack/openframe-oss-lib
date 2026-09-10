package com.openframe.data.document.rmm.software;

public enum SoftwareScriptCode {

    BREW_INSTALL("__software__brew-install"),
    BREW_UPDATE("__software__brew-update");

    private final String canonicalName;

    SoftwareScriptCode(String canonicalName) {
        this.canonicalName = canonicalName;
    }

    public String canonicalName() {
        return canonicalName;
    }
}
