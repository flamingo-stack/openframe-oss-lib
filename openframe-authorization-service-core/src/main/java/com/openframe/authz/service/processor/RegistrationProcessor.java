package com.openframe.authz.service.processor;

import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.tenant.Tenant;

/**
 * Interface for registration processing with pre and post processing hooks.
 * Provides default no-op implementations that can be overridden as needed.
 */
public interface RegistrationProcessor {

    /**
     * Pre-process hook for tenant registration.
     * Called before the tenant registration logic executes.
     */
    default void preProcessTenantRegistration() {
        // Default no-op implementation
    }

    /**
     * Post-process hook for tenant registration.
     * Called after the tenant has been successfully registered.
     *
     * @param tenant The registered tenant
     * @param user   The created user
     */
    default void postProcessTenantRegistration(Tenant tenant, AuthUser user) {
        // Default no-op implementation
    }

    /**
     * Post-process hook for invitation-based registration.
     * Called after the user has been successfully registered via invitation.
     *
     * @param user         The created user
     * @param invitationId The invitation identifier used for registration
     */
    default void postProcessInvitationRegistration(AuthUser user, String invitationId) {
        // Default no-op implementation
    }
}