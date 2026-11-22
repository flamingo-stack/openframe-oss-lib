package com.openframe.core.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** Selects the deployment's updated signup and workspace access policies. */
@ConfigurationProperties(AuthHardeningProperties.PREFIX)
public record AuthHardeningProperties(@DefaultValue("false") boolean enabled) {

    public static final String PREFIX = "openframe.auth.hardening";
    public static final String ENABLED = PREFIX + ".enabled";
}
