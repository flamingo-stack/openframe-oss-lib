package com.openframe.authz.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

@Data
@Component
@ConfigurationProperties(prefix = "openframe.sso.office")
public class OfficeSSOProperties {

    public static final String OFFICE = "office";

    private String registrationRedirectUri;
    private String loginRedirectUri;

    private String authorizationUrl;
    private String tokenUrl;
    private String userInfoUrl;
    private String issuerUri;
    private String jwkSetUri;

    private List<String> scopes;
}


