package com.openframe.graphql.node;

import com.openframe.security.authentication.AuthPrincipal;

// Called once per _entities request before any lookup; it throws to refuse the caller.
public interface EntityCallerAuthorizer {

    AuthPrincipal authorizeCaller();
}
