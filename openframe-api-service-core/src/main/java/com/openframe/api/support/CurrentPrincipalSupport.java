package com.openframe.api.support;

import com.openframe.core.exception.UnauthorizedException;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;

/**
 * Null-safe accessors for the current {@link AuthPrincipal} injected into GraphQL data fetchers via
 * {@code @AuthenticationPrincipal}. Each throws {@link UnauthorizedException} when the required claim
 * is missing, so callers can pass the resolved principal straight through.
 */
public final class CurrentPrincipalSupport {

    private CurrentPrincipalSupport() {
    }

    /** @return the current userId; throws if the principal is absent or carries no user id. */
    public static String requireUserId(AuthPrincipal principal) {
        String userId = principal == null ? null : principal.getId();
        if (userId == null || userId.isBlank()) {
            throw new UnauthorizedException("No authenticated user in the request");
        }
        return userId;
    }

    /**
     * @return the current userId, rejecting AGENT (machine) principals — for human-only features like
     * push devices, where an agent's id is a machine id, not a person.
     */
    public static String requireHumanUserId(AuthPrincipal principal) {
        if (principal != null && principal.getActorType() == ActorType.AGENT) {
            throw new UnauthorizedException("This operation is available to users only, not agents");
        }
        return requireUserId(principal);
    }
}
