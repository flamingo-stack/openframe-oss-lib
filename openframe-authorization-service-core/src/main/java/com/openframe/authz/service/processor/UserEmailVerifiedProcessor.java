package com.openframe.authz.service.processor;

import com.openframe.data.document.auth.AuthUser;

/**
 * Hook for reacting to user email verification changes in the Authorization Server.
 * Implementations can publish Kafka messages, audit logs, etc.
 */
public interface UserEmailVerifiedProcessor {

    /**
     * Called after user's emailVerified becomes true.
     *
     * @param user user with emailVerified=true
     */
    void postProcessEmailVerified(AuthUser user);
}

