package com.openframe.gateway.config.ws;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum CloseReason {
    JWT_EXPIRY("JWT expiry"),
    SESSION_CAP("remote session cap");

    private final String label;
}
