package com.openframe.api.service.processor;

import com.openframe.data.document.agent.AgentRegistrationSecret;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

/**
 * Default no-op implementation of AgentRegistrationSecretProcessor.
 * This bean will be used if no other implementation is provided (e.g. in OSS deployments).
 */
@Slf4j
@Component
@ConditionalOnMissingBean(value = AgentRegistrationSecretProcessor.class, ignored = DefaultAgentRegistrationSecretProcessor.class)
public class DefaultAgentRegistrationSecretProcessor implements AgentRegistrationSecretProcessor {

    @Override
    public void postProcessSecretGenerated(AgentRegistrationSecret secret, String decryptedKey) {
        log.debug("Agent registration secret generated: {}", secret.getId());
    }

    @Override
    public void postProcessSecretDeactivated(AgentRegistrationSecret secret) {
        log.debug("Agent registration secret deactivated: {}", secret.getId());
    }
}
