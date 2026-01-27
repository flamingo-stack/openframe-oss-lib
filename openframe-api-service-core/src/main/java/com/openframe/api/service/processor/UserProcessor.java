package com.openframe.api.service.processor;

import com.openframe.api.dto.user.UserPageResponse;
import com.openframe.data.document.user.User;

/**
 * Processor interface for user operations in API service.
 * Provides hooks for processing user operations.
 * Future implementations can publish events to Kafka.
 */
public interface UserProcessor {

    /**
     * Process after a user has been soft deleted.
     *
     * @param user The soft deleted user with DELETED status
     */
    void postProcessUserDeleted(User user);

    void postProcessUserGet(UserPageResponse response);

    /**
     * Process after a user has been updated.
     *
     * @param user The updated user
     */
    void postProcessUserUpdated(User user);
}