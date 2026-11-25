package com.openframe.sdk.fleetmdm.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Arrays;

public enum HostDeviceStatus {
    UNLOCKED("unlocked"),
    LOCKED("locked"),
    WIPED("wiped"),
    UNKNOWN("unknown");

    private final String value;

    HostDeviceStatus(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static HostDeviceStatus fromValue(String value) {
        return Arrays.stream(values())
                .filter(status -> status.value.equals(value))
                .findFirst()
                .orElse(UNKNOWN);
    }
}
