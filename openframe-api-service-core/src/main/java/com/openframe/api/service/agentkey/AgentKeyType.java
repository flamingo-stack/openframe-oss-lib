package com.openframe.api.service.agentkey;

import java.util.Arrays;

/**
 * The tenant-wide secrets agents present: the registration key (initialKey) on install
 * and the log key on the logs stream. {@code path} is how the type appears in the agent key API.
 */
public enum AgentKeyType {

    REGISTRATION("registration"),
    LOG("log");

    private final String path;

    AgentKeyType(String path) {
        this.path = path;
    }

    public String path() {
        return path;
    }

    public static AgentKeyType fromPath(String path) {
        return Arrays.stream(values())
                .filter(type -> type.path.equals(path))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown agent key type: " + path));
    }
}
