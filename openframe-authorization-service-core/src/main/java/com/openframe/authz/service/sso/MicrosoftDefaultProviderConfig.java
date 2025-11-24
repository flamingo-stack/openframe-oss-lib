package com.openframe.authz.service.sso;

import com.openframe.authz.config.oidc.MicrosoftSSOProperties;
import org.springframework.stereotype.Component;

import static com.openframe.authz.config.oidc.MicrosoftSSOProperties.MICROSOFT;

@Component
public class MicrosoftDefaultProviderConfig implements DefaultProviderConfig {

    private final MicrosoftSSOProperties props;

    public MicrosoftDefaultProviderConfig(MicrosoftSSOProperties props) {
        this.props = props;
    }

    @Override
    public String providerId() {
        return MICROSOFT;
    }

    @Override
    public String getDefaultClientId() {
        return props.getDefaultClientId();
    }

    @Override
    public String getDefaultClientSecret() {
        return props.getDefaultClientSecret();
    }
}
