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

    /**
     * Verified-email gate for the tenant-scoped login through the generic app (the nOAuth
     * defense). Off by default: enable per environment only after xms_edov is configured on the
     * generic app registration, or every generic Microsoft login fails.
     */
    private boolean requireVerifiedEmail = false;

    /**
     * Directory id Microsoft issues ALL personal-account tokens under, published in the identity
     * platform's token-claims reference. Configurable for test stubs only.
     */
    private String personalAccountsTenantId = "9188040d-6c67-4c5b-b112-36a304b66dad";

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
