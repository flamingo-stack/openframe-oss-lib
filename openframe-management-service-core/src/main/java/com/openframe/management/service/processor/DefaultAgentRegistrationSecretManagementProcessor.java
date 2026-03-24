package com.openframe.management.service.processor;

import com.openframe.data.document.agent.AgentRegistrationSecret;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@ConditionalOnMissingBean(value = AgentRegistrationSecretManagementProcessor.class, ignored = DefaultAgentRegistrationSecretManagementProcessor.class)
public class DefaultAgentRegistrationSecretManagementProcessor implements AgentRegistrationSecretManagementProcessor {

    @Override
    public void postProcessInitialSecretCreated(AgentRegistrationSecret secret, String decryptedKey) {
        log.debug("Initial agent registration secret created: {}", secret.getId());
    }
}
