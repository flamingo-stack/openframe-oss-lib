package com.openframe.api.service.processor;

import com.openframe.api.dto.user.UserPageResponse;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.data.document.user.User;

/**
 * Processor interface for user operations in API service.
 * Provides hooks for processing user operations.
 */
public interface UserProcessor {

    /**
     * Process after a user has been soft deleted.
     */
    default void postProcessUserDeleted(User user) {
        // Default no-op implementation
    }

    void postProcessUserGet(UserPageResponse response);

    void postProcessUserGet(UserResponse response);

    /**
     * Process after a user has been updated.
     */
    default void postProcessUserUpdated(User user) {
        // Default no-op implementation
    }
}
