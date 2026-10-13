package com.openframe.authz.service.processor;

import com.openframe.data.document.auth.AuthUser;

// Hook for reacting to user email verification changes (e.g. Kafka publish, audit log)
public interface UserEmailVerifiedProcessor {

    // Called after user's emailVerified becomes true
    void postProcessEmailVerified(AuthUser user);
}

