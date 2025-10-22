package com.openframe.authz.service.auth.strategy;

import com.openframe.authz.config.GoogleSSOProperties;
import com.openframe.authz.service.sso.SSOConfigService;
import com.openframe.data.document.sso.SSOConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.core.oidc.IdTokenClaimNames;
import org.springframework.stereotype.Component;

import static com.openframe.authz.config.GoogleSSOProperties.GOOGLE;
import static org.springframework.security.oauth2.core.AuthorizationGrantType.AUTHORIZATION_CODE;
import static org.springframework.security.oauth2.core.ClientAuthenticationMethod.CLIENT_SECRET_BASIC;

@Component
@RequiredArgsConstructor
public class GoogleClientRegistrationStrategy implements ClientRegistrationStrategy {

    private final SSOConfigService ssoConfigService;
    private final GoogleSSOProperties googleProps;

    @Override
    public String providerId() {
        return GOOGLE;
    }

    @Override
    public ClientRegistration buildClient(String tenantId) {
        SSOConfig cfg = ssoConfigService.getGoogleConfig(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("No active Google config for tenant " + tenantId));

        return ClientRegistration.withRegistrationId(GOOGLE)
                .clientId(cfg.getClientId())
                .clientSecret(ssoConfigService.getDecryptedClientSecret(cfg))
                .clientAuthenticationMethod(CLIENT_SECRET_BASIC)
                .authorizationGrantType(AUTHORIZATION_CODE)
                .redirectUri(googleProps.getLoginRedirectUri())
                .scope(googleProps.getScopes())
                .authorizationUri(googleProps.getAuthorizationUrl())
                .tokenUri(googleProps.getTokenUrl())
                .userInfoUri(googleProps.getUserInfoUrl())
                .userNameAttributeName(IdTokenClaimNames.SUB)
                .jwkSetUri(googleProps.getJwkSetUri())
                .clientName("Google (" + tenantId + ")")
                .build();
    }
}


