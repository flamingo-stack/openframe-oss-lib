package com.openframe.delivery.agent;

import static com.openframe.data.service.machine.AgentVersion.isAtLeast;
import static org.springframework.util.StringUtils.hasText;

// which agent versions take a type from the engine. Closed admits none; open with a min-version admits that
// version on, so an agent without a known version stays below it; open without one admits every agent
public record AgentVersionFloor(boolean open, String minVersion) {

    public static final AgentVersionFloor EVERY_VERSION = new AgentVersionFloor(true, "");
    public static final AgentVersionFloor CLOSED = new AgentVersionFloor(false, "");

    public static AgentVersionFloor from(String minVersion) {
        return hasText(minVersion) ? new AgentVersionFloor(true, minVersion) : EVERY_VERSION;
    }

    public boolean admits(String agentVersion) {
        if (!open) {
            return false;
        }
        return isForEveryVersion() || isAtLeast(agentVersion, minVersion);
    }

    public boolean isForEveryVersion() {
        return open && !hasText(minVersion);
    }
}
