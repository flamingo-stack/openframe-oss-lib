package com.openframe.authz.service.sso;

import com.openframe.authz.config.oidc.GoogleSSOProperties;
import org.springframework.stereotype.Component;

import static com.openframe.authz.config.oidc.GoogleSSOProperties.GOOGLE;

@Component
public class GoogleDefaultProviderConfig implements DefaultProviderConfig {

    private final GoogleSSOProperties props;

    public GoogleDefaultProviderConfig(GoogleSSOProperties props) {
        this.props = props;
    }

    @Override
    public String providerId() {
        return GOOGLE;
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
