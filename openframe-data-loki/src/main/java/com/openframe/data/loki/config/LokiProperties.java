package com.openframe.data.loki.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * Loki query connection settings.
 * <p>
 * Lives under {@code openframe.loki} rather than {@code loki}: OSS deployments already use
 * {@code loki.url} for the logback push appender.
 */
@Data
@ConfigurationProperties(prefix = "openframe.loki")
public class LokiProperties {

    private boolean enabled;

    /**
     * Base URL of the Loki gateway, e.g. {@code http://loki.internal.openframe.ai:80}.
     */
    private String url;

    private Duration connectTimeout = Duration.ofSeconds(2);

    /**
     * Upper bound for one query. These are user-facing reads, so it stays below Loki's own query timeout.
     */
    private Duration readTimeout = Duration.ofSeconds(30);
}
