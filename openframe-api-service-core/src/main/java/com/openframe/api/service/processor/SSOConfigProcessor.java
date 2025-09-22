package com.openframe.api.service.processor;

import com.openframe.data.document.sso.SSOConfig;

/**
 * Processor interface for SSO configuration operations in API service.
 * Provides hooks for processing SSO config operations.
 * Future implementations can publish events to Kafka.
 */
public interface SSOConfigProcessor {

    /**
     * Process after SSO configuration has been saved (created or updated).
     *
     * @param config The saved SSO configuration
     */
    default void postProcessConfigSaved(SSOConfig config) {
        // Default no-op implementation
    }

    /**
     * Process after SSO configuration has been deleted.
     *
     * @param config The deleted SSO configuration
     */
    default void postProcessConfigDeleted(SSOConfig config) {
        // Default no-op implementation
    }

    /**
     * Process after SSO configuration has been toggled (enabled/disabled).
     *
     * @param config The toggled SSO configuration
     */
    default void postProcessConfigToggled(SSOConfig config) {
        // Default no-op implementation
    }
}