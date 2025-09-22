package com.openframe.api.service.processor;

import com.openframe.data.document.user.User;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

/**
 * Default implementation of UserProcessor for API service.
 * This bean will be used if no other implementation is provided.
 */
@Slf4j
@Component
@ConditionalOnMissingBean(value = UserProcessor.class, ignored = DefaultUserProcessor.class)
public class DefaultUserProcessor implements UserProcessor {

    @Override
    public void postProcessUserRetrieved(User user) {
        log.debug("User retrieved: {}", user.getId());
    }

    @Override
    public void postProcessUserDeleted(User user) {
        log.debug("User deleted: {}", user.getId());
    }
}