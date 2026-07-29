package com.openframe.authz.service.auth.strategy;

import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static java.util.Locale.ROOT;
import static java.util.function.Function.identity;
import static java.util.stream.Collectors.toUnmodifiableMap;

/**
 * The set of SSO providers this deployment actually supports, derived from the registered
 * {@link ClientRegistrationStrategy} beans.
 * <p>
 * Anything that needs to ask "is this a provider we know?" should ask here rather than naming
 * providers inline — adding a provider then means adding its strategy and nothing else.
 */
@Component
public class SsoProviderRegistry {

    private final Map<String, ClientRegistrationStrategy> byProviderId;

    public SsoProviderRegistry(List<ClientRegistrationStrategy> strategies) {
        this.byProviderId = strategies.stream()
                .collect(toUnmodifiableMap(s -> s.providerId().toLowerCase(ROOT), identity()));
    }

    public boolean isSupported(String provider) {
        return provider != null && byProviderId.containsKey(provider.toLowerCase(ROOT));
    }

    public Set<String> supported() {
        return byProviderId.keySet();
    }

    /**
     * Extra ID-token validation the provider behind this registration requires, if any.
     * Empty for providers the OIDC defaults already cover.
     */
    public Optional<OAuth2TokenValidator<Jwt>> idTokenValidator(ClientRegistration registration) {
        if (registration == null || registration.getRegistrationId() == null) {
            return Optional.empty();
        }
        ClientRegistrationStrategy strategy = byProviderId.get(registration.getRegistrationId().toLowerCase(ROOT));
        return strategy == null ? Optional.empty() : strategy.idTokenValidator(registration);
    }
}
