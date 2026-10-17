package com.openframe.management.service.processor;

import com.openframe.data.document.agent.AgentRegistrationSecret;

// Processor interface for agent registration secret lifecycle in management service.
// Provides hook for syncing initial secret creation to external systems.
public interface AgentRegistrationSecretManagementProcessor {

    // Process after the initial agent registration secret has been created.
    // secret: the created secret; decryptedKey: the plaintext secret key
    default void postProcessInitialSecretCreated(AgentRegistrationSecret secret, String decryptedKey) {
        // Default no-op
    }
}
