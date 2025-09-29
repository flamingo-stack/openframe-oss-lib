package com.openframe.authz.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "openframe.authorization-server")
public record AuthzProps(String issuer) { }
