package com.openframe.authz.config.oidc;

import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@EqualsAndHashCode(callSuper = true)
@Component
@ConfigurationProperties(prefix = "openframe.sso.microsoft")
public class MicrosoftSSOProperties extends AbstractOidcProviderProperties {

    public static final String MICROSOFT = "microsoft";

    // Optional COMMON (multi-tenant) endpoints
    private String commonAuthorizationUrl;
    private String commonTokenUrl;
    private String commonJwkSetUri;
    private String commonIssuerUri;

    private String resolveEndpoint(String msTenantId, String tenantTemplate, String commonUrl) {
        return (msTenantId == null || msTenantId.isBlank())
                ? commonUrl
                : tenantTemplate.replace("{msTenantId}", msTenantId);
    }

    @Override
    public String effectiveAuthorizationUrl(String msTenantId) {
        return resolveEndpoint(msTenantId, getAuthorizationUrl(), getCommonAuthorizationUrl());
    }

    @Override
    public String effectiveTokenUrl(String msTenantId) {
        return resolveEndpoint(msTenantId, getTokenUrl(), getCommonTokenUrl());
    }

    @Override
    public String effectiveJwkSetUri(String msTenantId) {
        return resolveEndpoint(msTenantId, getJwkSetUri(), getCommonJwkSetUri());
    }

    @Override
    public String effectiveIssuerUri(String msTenantId) {
        return resolveEndpoint(msTenantId, getIssuerUri(), getCommonIssuerUri());
    }
}
