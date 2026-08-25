package com.openframe.api.service.processor;

import com.openframe.data.document.sso.SSOConfig;

// Hooks for processing SSO config operations; future implementations can publish events to Kafka.
public interface SSOConfigProcessor {

    // Process after SSO configuration has been saved (created or updated).
    default void postProcessConfigSaved(SSOConfig config) {
        // Default no-op implementation
    }

    // Process after SSO configuration has been deleted.
    default void postProcessConfigDeleted(SSOConfig config) {
        // Default no-op implementation
    }

    // Process after SSO configuration has been toggled (enabled/disabled).
    default void postProcessConfigToggled(SSOConfig config) {
        // Default no-op implementation
    }
}
