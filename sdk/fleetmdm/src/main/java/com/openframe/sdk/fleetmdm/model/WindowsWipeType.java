package com.openframe.sdk.fleetmdm.model;

public enum WindowsWipeType {
    DO_WIPE("doWipe"),
    DO_WIPE_PROTECTED("doWipeProtected");

    private final String value;

    WindowsWipeType(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }
}
