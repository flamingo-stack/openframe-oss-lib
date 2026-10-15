package com.openframe.api.dto.device;

import java.util.Arrays;
import java.util.List;

/**
 * Agent log levels, as carried by the {@code level} label of the agent-logs Loki stream.
 */
public enum DeviceLogLevel {
    DEBUG,
    INFO,
    WARN,
    ERROR;

    public static final List<String> NAMES = Arrays.stream(values()).map(Enum::name).toList();
}
