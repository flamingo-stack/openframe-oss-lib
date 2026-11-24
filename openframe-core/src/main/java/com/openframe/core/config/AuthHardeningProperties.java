package com.openframe.core.config;

import lombok.Value;
import lombok.experimental.Accessors;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** Selects the deployment's updated signup and workspace access policies. */
@Value
@Accessors(fluent = true)
@ConfigurationProperties(AuthHardeningProperties.PREFIX)
public class AuthHardeningProperties {

    public static final String PREFIX = "openframe.auth.hardening";
    public static final String ENABLED = PREFIX + ".enabled";

    boolean enabled;

    public AuthHardeningProperties(@DefaultValue("false") boolean enabled) {
        this.enabled = enabled;
    }
}
