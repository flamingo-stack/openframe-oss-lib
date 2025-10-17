package com.openframe.authz.service.processor;

import com.openframe.authz.dto.InvitationRegistrationRequest;
import com.openframe.authz.dto.TenantRegistrationRequest;
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
    default void preProcessTenantRegistration(TenantRegistrationRequest request) {
        // Default no-op implementation
    }

    /**
     * Post-process hook for tenant registration.
     * Called after the tenant has been successfully registered.
     *
     * @param tenant The registered tenant
     * @param user   The created user
     * @param request The original registration request
     */
    default void postProcessTenantRegistration(Tenant tenant, AuthUser user, TenantRegistrationRequest request) {
        // Default no-op implementation
    }

    /**
     * Post-process hook for invitation-based registration.
     * Called after the user has been successfully registered via invitation.
     *
     * @param user         The created user
     * @param invitationId The invitation identifier used for registration
     * @param request      The original invitation registration request
     */
    default void postProcessInvitationRegistration(AuthUser user, String invitationId, InvitationRegistrationRequest request) {
        // Default no-op implementation
    }
}