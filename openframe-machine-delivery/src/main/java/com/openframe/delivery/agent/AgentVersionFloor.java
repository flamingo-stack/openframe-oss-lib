package com.openframe.delivery.agent;

import static com.openframe.data.service.machine.AgentVersion.isAtLeast;
import static org.springframework.util.StringUtils.hasText;

// which agents take a type from the engine: with a min-version, that client version and up, so an agent without a
// known version stays below; without one, every agent
public record AgentVersionFloor(String minVersion) {

    public static final AgentVersionFloor EVERY_VERSION = new AgentVersionFloor("");

    public static AgentVersionFloor from(String minVersion) {
        return hasText(minVersion) ? new AgentVersionFloor(minVersion) : EVERY_VERSION;
    }

    public boolean admits(String agentVersion) {
        return isForEveryVersion() || isAtLeast(agentVersion, minVersion);
    }

    public boolean isForEveryVersion() {
        return !hasText(minVersion);
    }
}
