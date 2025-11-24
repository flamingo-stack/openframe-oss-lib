package com.openframe.authz.config.oidc;

import lombok.Data;

import java.util.List;

@Data
public abstract class AbstractOidcProviderProperties {

    private String registrationRedirectUri;
    private String loginRedirectUri;

    // Optional defaults to allow global fallback when tenant-specific config is absent
    private String defaultClientId;
    private String defaultClientSecret;

    private String authorizationUrl;
    private String tokenUrl;
    private String userInfoUrl;
    private String issuerUri;
    private String jwkSetUri;

    private List<String> scopes;

    public String effectiveAuthorizationUrl(String msTenantId) {
        return getAuthorizationUrl();
    }

    public String effectiveTokenUrl(String msTenantId) {
        return getTokenUrl();
    }

    public String effectiveJwkSetUri(String msTenantId) {
        return getJwkSetUri();
    }

    public String effectiveIssuerUri(String msTenantId) {
        return getIssuerUri();
    }
}


