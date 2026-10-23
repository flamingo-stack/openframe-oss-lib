package com.openframe.data.document.rmm.software;

public enum SoftwareAction {
    INSTALL,
    UPDATE;

    public <T> T select(T install, T update) {
        return this == INSTALL ? install : update;
    }
}
