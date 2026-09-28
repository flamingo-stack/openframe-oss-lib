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

    /**
     * Ceiling on the bytes one query may read, e.g. {@code 5GB}, sent per request so it applies to this client alone -
     * a server-side {@code max_query_bytes_read} would also cap Grafana's legitimate cross-tenant queries. The header
     * can only lower Loki's own limits, never raise them, so it is safe to send even though Loki has no auth here.
     * <p>
     * Empty sends no header. Loki ignores the header entirely unless {@code querier.per_request_limits_enabled} is
     * true, which today is set on prod only.
     * <p>
     * Mind what the cap is measured against: the streams the selector picks, before the {@code machine_id} filter. A
     * single-device query therefore costs the same as a whole-tenant one over the same window.
     */
    private String maxQueryBytesRead;

    private Duration connectTimeout = Duration.ofSeconds(2);

    /**
     * Upper bound for one query. These are user-facing reads, so it stays below Loki's own query timeout.
     */
    private Duration readTimeout = Duration.ofSeconds(30);
}
