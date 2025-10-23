package com.openframe.authz.config.oidc;

import lombok.Data;

import java.util.List;

@Data
public abstract class AbstractOidcProviderProperties {

    private String registrationRedirectUri;
    private String loginRedirectUri;

    private String authorizationUrl;
    private String tokenUrl;
    private String userInfoUrl;
    private String issuerUri;
    private String jwkSetUri;

    private List<String> scopes;
}


