package com.openframe.api.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "openframe.security.jwt.cache")
public class JwtCacheProperties {

    private Duration expireAfter;

    private Duration refreshAfter;

    private long maximumSize;
}
