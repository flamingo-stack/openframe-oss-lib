package com.openframe.authz.service.auth.strategy;

import com.openframe.authz.config.oidc.AbstractOidcProviderProperties;
import com.openframe.authz.config.oidc.MicrosoftSSOProperties;
import com.openframe.authz.service.sso.SSOConfigService;
import org.springframework.stereotype.Component;

@Component
public class MicrosoftClientRegistrationStrategy extends BaseOidcClientRegistrationStrategy {

    private final MicrosoftSSOProperties microsoftProps;

    public MicrosoftClientRegistrationStrategy(SSOConfigService ssoConfigService, MicrosoftSSOProperties microsoftProps) {
        super(ssoConfigService);
        this.microsoftProps = microsoftProps;
    }

    @Override
    public String providerId() {
        return MicrosoftSSOProperties.MICROSOFT;
    }

    @Override
    protected AbstractOidcProviderProperties props() {
        return microsoftProps;
    }
}



