package com.openframe.gateway.metrics;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum WebSocketKind {
    RELAY("true"),
    CHANNEL("false");

    private final String relayTag;
}
