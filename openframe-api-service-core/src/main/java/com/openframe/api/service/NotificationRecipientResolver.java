package com.openframe.api.service;

import com.openframe.api.dto.notification.NotificationRecipient;
import com.openframe.core.exception.UnauthorizedException;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

import static org.apache.commons.lang3.StringUtils.isBlank;

/**
 * Resolves the recipient of notification read states from the JWT in the security context and from
 * nothing else: the request never says whose notifications to read or count.
 */
@Component
public class NotificationRecipientResolver {

    public NotificationRecipient current() {
        AuthPrincipal principal = currentPrincipal();
        if (principal.getActorType() == ActorType.AGENT) {
            String machineId = principal.getMachineId();
            if (isBlank(machineId)) {
                throw new UnauthorizedException("AGENT principal missing machine_id claim");
            }
            return new NotificationRecipient(machineId, RecipientType.MACHINE);
        }
        String userId = principal.getId();
        if (isBlank(userId)) {
            throw new UnauthorizedException("Authenticated user is required to access notifications");
        }
        return new NotificationRecipient(userId, RecipientType.USER);
    }

    private static AuthPrincipal currentPrincipal() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof JwtAuthenticationToken jwtAuth) {
            return AuthPrincipal.fromJwt(jwtAuth.getToken());
        }
        throw new UnauthorizedException("Notifications require a JWT-authenticated principal; got "
                + (authentication == null ? "no authentication" : authentication.getClass().getSimpleName()));
    }
}
