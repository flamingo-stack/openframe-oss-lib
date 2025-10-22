package com.openframe.authz.service.auth.strategy;

import com.openframe.authz.config.OfficeSSOProperties;
import com.openframe.authz.service.sso.SSOConfigService;
import com.openframe.data.document.sso.SSOConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.core.oidc.IdTokenClaimNames;
import org.springframework.stereotype.Component;

import static org.springframework.security.oauth2.core.AuthorizationGrantType.AUTHORIZATION_CODE;
import static org.springframework.security.oauth2.core.ClientAuthenticationMethod.CLIENT_SECRET_BASIC;

@Component
@RequiredArgsConstructor
public class OfficeClientRegistrationStrategy implements ClientRegistrationStrategy {

    private final SSOConfigService ssoConfigService;
    private final OfficeSSOProperties officeProps;

    @Override
    public String providerId() {
        return OfficeSSOProperties.OFFICE;
    }

    @Override
    public ClientRegistration buildClient(String tenantId) {
        SSOConfig cfg = ssoConfigService.getOfficeConfig(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("No active Office SSO config for tenant " + tenantId));

        return ClientRegistration.withRegistrationId(OfficeSSOProperties.OFFICE)
                .clientId(cfg.getClientId())
                .clientSecret(ssoConfigService.getDecryptedClientSecret(cfg))
                .clientAuthenticationMethod(CLIENT_SECRET_BASIC)
                .authorizationGrantType(AUTHORIZATION_CODE)
                .redirectUri(officeProps.getLoginRedirectUri())
                .scope(officeProps.getScopes())
                .authorizationUri(officeProps.getAuthorizationUrl())
                .tokenUri(officeProps.getTokenUrl())
                .userInfoUri(officeProps.getUserInfoUrl())
                .userNameAttributeName(IdTokenClaimNames.SUB)
                .jwkSetUri(officeProps.getJwkSetUri())
                .clientName("Office 365 (" + tenantId + ")")
                .build();
    }
}


