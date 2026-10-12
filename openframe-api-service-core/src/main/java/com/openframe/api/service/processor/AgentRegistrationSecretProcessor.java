package com.openframe.api.service.processor;

import com.openframe.data.document.agent.AgentRegistrationSecret;

// Hooks for syncing agent registration secret changes to external systems (e.g. shared cluster via Kafka).
public interface AgentRegistrationSecretProcessor {

    // Called after a new agent registration secret has been generated.
    default void postProcessSecretGenerated(AgentRegistrationSecret secret, String decryptedKey) {
        // Default no-op implementation
    }

    // Called after an agent registration secret has been deactivated.
    default void postProcessSecretDeactivated(AgentRegistrationSecret secret) {
        // Default no-op implementation
    }
}
