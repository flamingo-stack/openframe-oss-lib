package com.openframe.core.agentkey;

/**
 * Reads and rotates one {@link AgentKeyType}. Rotating makes a new key the current one and
 * the previous key stops being accepted; agents that are already registered keep working.
 */
public interface AgentKeyProvider {

    AgentKeyType type();

    AgentKeyResponse current();

    AgentKeyResponse rotate();
}
