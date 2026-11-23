package com.openframe.data.document.rmm.software;

public enum SoftwareScriptCode {

    BREW_INSTALL("__software__brew-install"),
    BREW_UPDATE("__software__brew-update"),
    WINGET_INSTALL("__software__winget-install"),
    WINGET_UPDATE("__software__winget-update"),
    CHOCO_INSTALL("__software__choco-install"),
    CHOCO_UPDATE("__software__choco-update");

    // the scriptId of an adoption's history rows: no script document has it, an adoption is an order. Not values of
    // the enum, as every value is seeded as a script
    public static final String BREW_ADOPT_SCRIPT_ID = "__software__brew-adopt";
    public static final String CHOCO_ADOPT_SCRIPT_ID = "__software__choco-adopt";

    private final String canonicalName;

    SoftwareScriptCode(String canonicalName) {
        this.canonicalName = canonicalName;
    }

    public String canonicalName() {
        return canonicalName;
    }
}
