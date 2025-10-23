package com.openframe.authz.service.auth.strategy;

import com.openframe.authz.config.oidc.AbstractOidcProviderProperties;
import com.openframe.authz.config.oidc.OfficeSSOProperties;
import com.openframe.authz.service.sso.SSOConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
public class OfficeClientRegistrationStrategy extends BaseOidcClientRegistrationStrategy {

    private final OfficeSSOProperties officeProps;

    public OfficeClientRegistrationStrategy(SSOConfigService ssoConfigService, OfficeSSOProperties officeProps) {
        super(ssoConfigService);
        this.officeProps = officeProps;
    }

    @Override
    public String providerId() {
        return OfficeSSOProperties.OFFICE;
    }

    @Override
    protected AbstractOidcProviderProperties props() {
        return officeProps;
    }
}


