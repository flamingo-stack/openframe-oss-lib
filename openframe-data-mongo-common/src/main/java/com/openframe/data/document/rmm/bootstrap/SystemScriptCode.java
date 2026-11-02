package com.openframe.data.document.rmm.bootstrap;

public enum SystemScriptCode {

    INSTALL_WINGET("__system__install-winget"),
    INSTALL_WINGET_CLIENT_MODULE("__system__install-winget-client-module"),
    INSTALL_CHOCOLATEY("__system__install-chocolatey"),
    INSTALL_BREW("__system__install-brew");

    private final String canonicalName;

    SystemScriptCode(String canonicalName) {
        this.canonicalName = canonicalName;
    }

    public String canonicalName() {
        return canonicalName;
    }
}
