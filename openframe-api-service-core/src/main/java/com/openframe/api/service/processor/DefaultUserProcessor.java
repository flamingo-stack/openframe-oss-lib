package com.openframe.api.service.processor;

import com.openframe.api.dto.user.UserPageResponse;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.data.document.user.User;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

/**
 * Default no-op implementation of {@link UserProcessor}.
 * Used when no SaaS-specific override is provided, so the api-service-core
 * module can start up standalone.
 */
@Component
@ConditionalOnMissingBean(UserProcessor.class)
public class DefaultUserProcessor implements UserProcessor {

    @Override
    public void postProcessUserDeleted(User user) {
    }

    @Override
    public void postProcessUserGet(UserPageResponse response) {
    }

    @Override
    public void postProcessUserGet(UserResponse response) {
    }

    @Override
    public void postProcessUserUpdated(User user) {
    }
}
