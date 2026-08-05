package com.openframe.authz.service.auth.strategy;

import com.openframe.authz.config.oidc.AbstractOidcProviderProperties;
import com.openframe.authz.service.sso.SSOConfigService;
import com.openframe.data.document.sso.SSOConfig;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
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
        SSOConfig cfg = ssoConfigService.getEffectiveSSOConfig(tenantId, provider)
                .orElseThrow(() -> new IllegalArgumentException("No active SSO config for provider '" + provider + "' (tenant-specific or default) and tenant " + tenantId));

        AbstractOidcProviderProperties props = props();
        String msTenantId = cfg.getMsTenantId();

        ClientRegistration.Builder builder = ClientRegistration.withRegistrationId(provider)
                .clientId(cfg.getClientId())
                .clientSecret(clientSecret(cfg))
                .clientAuthenticationMethod(clientAuthenticationMethod())
                .authorizationGrantType(AUTHORIZATION_CODE)
                .redirectUri(props.getLoginRedirectUri())
                .scope(props.getScopes())
                .authorizationUri(props.effectiveAuthorizationUrl(msTenantId))
                .tokenUri(props.effectiveTokenUrl(msTenantId))
                .userInfoUri(props.getUserInfoUrl())
                .userNameAttributeName(IdTokenClaimNames.SUB)
                .jwkSetUri(props.effectiveJwkSetUri(msTenantId))
                .clientName(capitalize(provider) + " (" + tenantId + ")");
        customize(builder, cfg);
        return builder.build();
    }

    /** The value sent as {@code client_secret}. Default: the stored secret, decrypted. */
    protected String clientSecret(SSOConfig cfg) {
        return ssoConfigService.getDecryptedClientSecret(cfg);
    }

    /** How the client authenticates at the token endpoint. Apple only accepts {@code client_secret_post}. */
    protected ClientAuthenticationMethod clientAuthenticationMethod() {
        return CLIENT_SECRET_BASIC;
    }

    /** Last-word hook for provider-specific registration details (e.g. a fixed issuer). */
    protected void customize(ClientRegistration.Builder builder, SSOConfig cfg) {
    }

    private static String capitalize(String s) {
        if (s == null || s.isEmpty()) {
            return s;
        }
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
