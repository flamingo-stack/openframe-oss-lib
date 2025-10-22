package com.openframe.authz.service.auth;

import com.openframe.authz.config.GoogleSSOProperties;
import com.openframe.authz.service.sso.SSOConfigService;
import com.openframe.authz.config.OfficeSSOProperties;
import com.openframe.data.document.sso.SSOConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.core.oidc.IdTokenClaimNames;
import org.springframework.stereotype.Service;

import static com.openframe.authz.config.GoogleSSOProperties.GOOGLE;
import static org.springframework.security.oauth2.core.AuthorizationGrantType.AUTHORIZATION_CODE;
import static org.springframework.security.oauth2.core.ClientAuthenticationMethod.CLIENT_SECRET_BASIC;

@Service
@RequiredArgsConstructor
@Slf4j
public class DynamicClientRegistrationService {

    private final SSOConfigService ssoConfigService;
    private final GoogleSSOProperties googleProps;
    private final OfficeSSOProperties officeProps;

    public ClientRegistration loadGoogleClient(String tenantId) {
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

    public ClientRegistration loadOfficeClient(String tenantId) {
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


