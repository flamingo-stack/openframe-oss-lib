package com.openframe.data.document.device.chocolatey;

import java.util.Arrays;

public enum ChocolateyStatus {
    MANAGED,
    UPGRADE_REQUIRED,
    ACTION_REQUIRED,
    UNKNOWN;

    public static ChocolateyStatus fromWire(String value) {
        return Arrays.stream(values())
                .filter(status -> status.name().equals(value))
                .findFirst()
                .orElse(UNKNOWN);
    }
}
