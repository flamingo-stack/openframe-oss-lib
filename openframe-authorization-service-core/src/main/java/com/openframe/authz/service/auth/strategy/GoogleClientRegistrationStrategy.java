package com.openframe.authz.service.auth.strategy;

import com.openframe.authz.config.oidc.AbstractOidcProviderProperties;
import com.openframe.authz.config.oidc.GoogleSSOProperties;
import com.openframe.authz.service.sso.SSOConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import static com.openframe.authz.config.oidc.GoogleSSOProperties.GOOGLE;

@Component
public class GoogleClientRegistrationStrategy extends BaseOidcClientRegistrationStrategy {

    private final GoogleSSOProperties googleProps;

    public GoogleClientRegistrationStrategy(SSOConfigService ssoConfigService, GoogleSSOProperties googleProps) {
        super(ssoConfigService);
        this.googleProps = googleProps;
    }

    @Override
    public String providerId() {
        return GOOGLE;
    }

    @Override
    protected AbstractOidcProviderProperties props() {
        return googleProps;
    }
}


