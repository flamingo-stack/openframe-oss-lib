package com.openframe.authz.service.processor;

import com.openframe.data.document.auth.AuthUser;

// Hook for reacting to user email verification changes in the Authorization Server.
public interface UserEmailVerifiedProcessor {

    void postProcessEmailVerified(AuthUser user);
}

