package com.openframe.api.service.agentkey;

/**
 * The tenant-wide secrets agents present: the registration key (initialKey) on install
 * and the log key on the logs stream. In the agent key API the type is the path segment,
 * matched case-insensitively ({@code /agent/keys/log}).
 */
public enum AgentKeyType {
    REGISTRATION,
    LOG
}
