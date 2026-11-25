package com.openframe.sdk.fleetmdm.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Arrays;

public enum HostPendingAction {
    NONE(""),
    LOCK("lock"),
    UNLOCK("unlock"),
    WIPE("wipe"),
    UNKNOWN("unknown");

    private final String value;

    HostPendingAction(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static HostPendingAction fromValue(String value) {
        return Arrays.stream(values())
                .filter(action -> action.value.equals(value))
                .findFirst()
                .orElse(UNKNOWN);
    }
}
