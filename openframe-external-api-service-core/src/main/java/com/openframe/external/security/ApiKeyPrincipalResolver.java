package com.openframe.external.security;

import com.openframe.core.exception.ForbiddenException;
import com.openframe.core.exception.UnauthorizedException;
import com.openframe.data.document.user.User;
import com.openframe.data.document.user.UserRole;
import com.openframe.data.document.user.UserStatus;
import com.openframe.data.repository.user.UserRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import static org.springframework.util.StringUtils.hasText;

/**
 * Turns the identity the gateway resolved from an API key ({@code X-User-Id}) into the
 * {@link AuthPrincipal} the domain services expect, so external calls run exactly as that user
 * would from the dashboard. The gateway has already validated the key and applied rate limits.
 */
@Component
@RequiredArgsConstructor
public class ApiKeyPrincipalResolver {

    private final UserRepository userRepository;
    private final TenantIdProvider tenantIdProvider;

    public AuthPrincipal resolve(String userId) {
        if (!hasText(userId)) {
            throw new UnauthorizedException("API key is not bound to a user");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UnauthorizedException("API key owner not found"));
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new ForbiddenException("API key owner is not active");
        }
        return AuthPrincipal.builder()
                .id(user.getId())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .roles(UserRole.effective(user.getRoles()).stream().map(Enum::name).toList())
                .scopes(java.util.List.of())
                .tenantId(tenantIdProvider.getTenantId())
                .actorType(ActorType.ADMIN)
                .build();
    }
}
