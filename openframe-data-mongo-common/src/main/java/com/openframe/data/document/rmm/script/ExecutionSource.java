package com.openframe.data.document.rmm.script;

public enum ExecutionSource {
    MANUAL,
    SCHEDULED,
    AI_ASSISTANT,
    SYSTEM_BOOTSTRAP,
    PACKAGE_INSTALLATION,
    PACKAGE_UPDATE,
    PACKAGE_AUTO_UPDATE;

    public boolean isSystemOwned() {
        return this == SYSTEM_BOOTSTRAP || this == PACKAGE_INSTALLATION
                || this == PACKAGE_UPDATE || this == PACKAGE_AUTO_UPDATE;
    }
}
