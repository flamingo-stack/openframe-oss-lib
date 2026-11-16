package com.openframe.api.service;

import com.openframe.api.dto.AgentRegistrationSecretResponse;
import com.openframe.core.agentkey.AgentKeyProvider;
import com.openframe.core.agentkey.AgentKeyResponse;
import com.openframe.core.agentkey.AgentKeyType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * The registration key (initialKey) behind the generic agent key API. Rotation goes through
 * {@link AgentRegistrationSecretService} so the old key is deactivated and the processor hooks still run.
 */
@Component
@RequiredArgsConstructor
public class RegistrationAgentKeyProvider implements AgentKeyProvider {

    private final AgentRegistrationSecretService secretService;

    @Override
    public AgentKeyType type() {
        return AgentKeyType.REGISTRATION;
    }

    @Override
    public AgentKeyResponse current() {
        return toResponse(secretService.getActiveSecret());
    }

    @Override
    public AgentKeyResponse rotate() {
        return toResponse(secretService.generateNewSecret());
    }

    private static AgentKeyResponse toResponse(AgentRegistrationSecretResponse secret) {
        return new AgentKeyResponse(secret.getKey(), secret.getCreatedAt());
    }
}
