package com.openframe.authz.service.processor;

import com.openframe.data.document.auth.AuthUser;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

/**
 * Default implementation of UserDeactivationProcessor for authorization service.
 * This bean will be used if no other implementation is provided.
 */
@Slf4j
@Component
@ConditionalOnMissingBean(value = UserDeactivationProcessor.class, ignored = DefaultUserDeactivationProcessor.class)
public class DefaultUserDeactivationProcessor implements UserDeactivationProcessor {
    @Override
    public void postProcessDeactivation(AuthUser existing) {
        log.debug("User deactivated: {}", existing.getId());
    }
}
