package com.openframe.api.util;

import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import lombok.experimental.UtilityClass;

/**
 * Stateless authorization helpers shared by the domain services that take an {@link AuthPrincipal}.
 */
@UtilityClass
public class AuthPrincipalUtils {

    public static void validateAdminAccess(AuthPrincipal principal) {
        if (principal.getActorType() != ActorType.ADMIN) {
            throw new IllegalStateException("Operation requires ADMIN access");
        }
    }

    public static boolean isAgent(AuthPrincipal principal) {
        return principal.getActorType() == ActorType.AGENT;
    }

    public static boolean isAdmin(AuthPrincipal principal) {
        return principal.getActorType() == ActorType.ADMIN;
    }

    public static String getActorId(AuthPrincipal principal) {
        return isAgent(principal) ? principal.getMachineId() : principal.getId();
    }
}
