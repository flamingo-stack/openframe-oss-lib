package com.openframe.authz.service.sso;

import com.openframe.authz.config.oidc.AppleSSOProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import static com.openframe.authz.config.oidc.AppleSSOProperties.APPLE;

@Component
@RequiredArgsConstructor
public class AppleDefaultProviderConfig implements DefaultProviderConfig {

    private final AppleSSOProperties props;

    @Override
    public String providerId() {
        return APPLE;
    }

    @Override
    public String getDefaultClientId() {
        return props.getDefaultClientId();
    }

    /**
     * For Apple the "client secret" slot holds the .p8 private key (PEM); the actual client_secret
     * JWT is minted from it per request by {@code AppleClientRegistrationStrategy}.
     */
    @Override
    public String getDefaultClientSecret() {
        return props.getDefaultClientSecret();
    }

    @Override
    public String getDefaultTeamId() {
        return props.getDefaultTeamId();
    }

    @Override
    public String getDefaultKeyId() {
        return props.getDefaultKeyId();
    }

    /** Apple additionally needs teamId and keyId to mint the client-secret JWT. */
    @Override
    public boolean isConfigured() {
        return DefaultProviderConfig.super.isConfigured()
                && props.getDefaultTeamId() != null && !props.getDefaultTeamId().isBlank()
                && props.getDefaultKeyId() != null && !props.getDefaultKeyId().isBlank();
    }
}
