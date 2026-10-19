package com.openframe.authz.service.auth.strategy;

import com.openframe.authz.config.oidc.AbstractOidcProviderProperties;
import com.openframe.authz.config.oidc.GoogleSSOProperties;
import com.openframe.authz.service.sso.SSOConfigService;
import com.openframe.data.document.sso.SSOConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.stereotype.Component;

import static com.openframe.authz.config.oidc.GoogleSSOProperties.GOOGLE;
import static org.springframework.util.StringUtils.hasText;

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

    // Google has exactly one issuer; pinning it lets the standard validator stack enforce it too.
    @Override
    protected void customize(ClientRegistration.Builder builder, SSOConfig cfg) {
        if (hasText(googleProps.getIssuerUri())) {
            builder.issuerUri(googleProps.getIssuerUri());
        }
    }
}
