package com.openframe.authz.config.oidc;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "openframe.sso.google")
public class GoogleSSOProperties extends AbstractOidcProviderProperties {

    public static final String GOOGLE = "google";
}


