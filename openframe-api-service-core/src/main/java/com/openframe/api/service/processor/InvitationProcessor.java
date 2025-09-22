package com.openframe.api.service.processor;

import com.openframe.data.document.user.Invitation;

/**
 * Processor interface for invitation operations.
 * Provides hooks for processing invitation creation and revocation.
 * Future implementations can publish events to Kafka.
 */
public interface InvitationProcessor {

    /**
     * Process after an invitation has been created.
     *
     * @param invitation The created invitation with all fields populated
     */
    default void postProcessInvitationCreated(Invitation invitation) {
        // Default no-op implementation
    }

    /**
     * Process after an invitation has been revoked.
     *
     * @param invitation The revoked invitation with REVOKED status
     */
    default void postProcessInvitationRevoked(Invitation invitation) {
        // Default no-op implementation
    }
}