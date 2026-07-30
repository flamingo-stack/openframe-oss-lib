package com.openframe.authz.service.auth.strategy;

import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.Optional;

public interface ClientRegistrationStrategy {

    String providerId();

    ClientRegistration buildClient(String tenantId);

    /**
     * Extra ID-token validation beyond the OIDC defaults, for providers whose issuer or claims
     * need it. Most need none, so the default is empty.
     */
    default Optional<OAuth2TokenValidator<Jwt>> idTokenValidator(ClientRegistration registration) {
        return Optional.empty();
    }
}


