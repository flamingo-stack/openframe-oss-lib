package com.openframe.api.service.processor;

import com.openframe.data.document.agent.AgentRegistrationSecret;

/**
 * Processor interface for agent registration secret operations.
 * Provides hooks for syncing secret changes to external systems (e.g. shared cluster via Kafka).
 */
public interface AgentRegistrationSecretProcessor {

    /**
     * Process after a new agent registration secret has been generated.
     *
     * @param secret the new active secret
     * @param decryptedKey the plaintext secret key
     */
    default void postProcessSecretGenerated(AgentRegistrationSecret secret, String decryptedKey) {
        // Default no-op implementation
    }

    /**
     * Process after an agent registration secret has been deactivated.
     *
     * @param secret the deactivated secret
     */
    default void postProcessSecretDeactivated(AgentRegistrationSecret secret) {
        // Default no-op implementation
    }
}
