package com.openframe.client.service.agentregistration.processor;

import com.openframe.client.dto.agent.AgentRegistrationRequest;
import com.openframe.data.document.device.Machine;

/**
 * Interface for agent registration processing with post processing hooks.
 * Provides default no-op implementations that can be overridden as needed.
 */
public interface AgentRegistrationProcessor {

    /**
     * Post-process hook for agent registration.
     * Called after the agent has been successfully registered.
     *
     * @param machine The registered machine
     * @param request The original registration request
     */
    default void postProcessAgentRegistration(Machine machine, AgentRegistrationRequest request) {
        // Default no-op implementation
    }
}

