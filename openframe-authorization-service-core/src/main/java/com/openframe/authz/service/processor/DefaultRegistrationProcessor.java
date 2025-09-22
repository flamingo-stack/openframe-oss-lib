package com.openframe.authz.service.processor;

import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.tenant.Tenant;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

/**
 * Default implementation of RegistrationProcessor.
 * This bean will be used if no other implementation is provided.
 * All methods provide no-op implementations that can be overridden by custom processors.
 */
@Slf4j
@Component
@ConditionalOnMissingBean(value = RegistrationProcessor.class, ignored = DefaultRegistrationProcessor.class)
public class DefaultRegistrationProcessor implements RegistrationProcessor {

    @Override
    public void preProcessTenantRegistration() {
        // Default no-op implementation
        log.debug("Default pre-processing tenant registration");
    }

    @Override
    public void postProcessTenantRegistration(Tenant tenant, AuthUser user) {
        // Default no-op implementation
        log.debug("Default post-processing tenant registration for tenant: {} and user: {}",
                tenant.getId(), user.getId());
    }

    @Override
    public void postProcessInvitationRegistration(AuthUser user, String invitationId) {
        // Default no-op implementation
        log.debug("Default post-processing invitation registration for user: {} with invitation: {}",
                user.getId(), invitationId);
    }
}