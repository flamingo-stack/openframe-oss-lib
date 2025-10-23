package com.openframe.authz.service.auth.strategy;

import com.openframe.authz.config.oidc.AbstractOidcProviderProperties;
import com.openframe.authz.service.sso.SSOConfigService;
import com.openframe.data.document.sso.SSOConfig;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.core.oidc.IdTokenClaimNames;

import static org.springframework.security.oauth2.core.AuthorizationGrantType.AUTHORIZATION_CODE;
import static org.springframework.security.oauth2.core.ClientAuthenticationMethod.CLIENT_SECRET_BASIC;

public abstract class BaseOidcClientRegistrationStrategy implements ClientRegistrationStrategy {

    protected final SSOConfigService ssoConfigService;

    protected BaseOidcClientRegistrationStrategy(SSOConfigService ssoConfigService) {
        this.ssoConfigService = ssoConfigService;
    }

    protected abstract AbstractOidcProviderProperties props();

    @Override
    public ClientRegistration buildClient(String tenantId) {
        String provider = providerId();
        SSOConfig cfg = ssoConfigService.getSSOConfig(tenantId, provider)
                .orElseThrow(() -> new IllegalArgumentException("No active SSO config for provider '" + provider + "' and tenant " + tenantId));

        AbstractOidcProviderProperties p = props();
        return ClientRegistration.withRegistrationId(provider)
                .clientId(cfg.getClientId())
                .clientSecret(ssoConfigService.getDecryptedClientSecret(cfg))
                .clientAuthenticationMethod(CLIENT_SECRET_BASIC)
                .authorizationGrantType(AUTHORIZATION_CODE)
                .redirectUri(p.getLoginRedirectUri())
                .scope(p.getScopes())
                .authorizationUri(p.getAuthorizationUrl())
                .tokenUri(p.getTokenUrl())
                .userInfoUri(p.getUserInfoUrl())
                .userNameAttributeName(IdTokenClaimNames.SUB)
                .jwkSetUri(p.getJwkSetUri())
                .clientName(capitalize(provider) + " (" + tenantId + ")")
                .build();
    }

    private static String capitalize(String s) {
        if (s == null || s.isEmpty()) {
            return s;
        }
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}


