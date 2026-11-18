package com.openframe.api.service.agentkey;

import com.openframe.core.agentkey.AgentKeyResponse;

/**
 * Strategy for one {@link AgentKeyType}: reads the current key and rotates it. After a rotation
 * the new key is the one agents must present; agents that are already registered keep working.
 */
public interface AgentKeyProvider {

    AgentKeyType type();

    AgentKeyResponse current();

    AgentKeyResponse rotate();
}
