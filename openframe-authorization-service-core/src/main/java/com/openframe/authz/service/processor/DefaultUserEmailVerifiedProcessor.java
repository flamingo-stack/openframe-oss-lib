package com.openframe.authz.service.processor;

import com.openframe.data.document.auth.AuthUser;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

/**
 * Default no-op implementation of UserEmailVerifiedProcessor.
 */
@Slf4j
@Component
@ConditionalOnMissingBean(value = UserEmailVerifiedProcessor.class, ignored = DefaultUserEmailVerifiedProcessor.class)
public class DefaultUserEmailVerifiedProcessor implements UserEmailVerifiedProcessor {
    @Override
    public void postProcessEmailVerified(AuthUser user) {
        log.debug("User email verified: {}", user.getId());
    }
}

