package com.openframe.client.service.agentregistration.processor;

import com.openframe.client.dto.agent.AgentRegistrationRequest;
import com.openframe.data.document.device.Machine;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

/**
 * Default implementation of AgentRegistrationProcessor.
 * This bean will be used if no other implementation is provided.
 * All methods provide no-op implementations that can be overridden by custom processors.
 */
@Slf4j
@Component
@ConditionalOnMissingBean(value = AgentRegistrationProcessor.class, ignored = DefaultAgentRegistrationProcessor.class)
public class DefaultAgentRegistrationProcessor implements AgentRegistrationProcessor {

    @Override
    public void postProcessAgentRegistration(Machine machine, AgentRegistrationRequest request) {
        // Default no-op implementation
        log.debug("Default post-processing agent registration for machine: {} with hostname: {}",
                machine.getMachineId(), request.getHostname());
    }
}

