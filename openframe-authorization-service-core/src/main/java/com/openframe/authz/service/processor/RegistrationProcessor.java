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
     * Returns the tenantId that the new Tenant document must adopt.
     * SaaS implementations atomically claim a pre-provisioned cluster and return its
     * pre-generated tenantId so the Tenant._id matches tenant_cluster_registrations.tenantId,
     * and throw if no READY cluster is available.
     * The OSS default generates a fresh id.
     */
    default String reserveTenantIdForRegistration(TenantRegistrationRequest request) {
        return Tenant.generateTenantId();
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

    /**
     * Post-process hook for auto-provisioned registrations (SSO first-login)
     * and for refreshing profile data on subsequent SSO logins.
     *
     * @param user       The user (newly created or already existing)
     * @param pictureUrl Optional profile picture URL captured from the SSO `picture` claim
     */
    default void postProcessAutoProvision(AuthUser user, String pictureUrl) {
        // Default no-op implementation
    }
}