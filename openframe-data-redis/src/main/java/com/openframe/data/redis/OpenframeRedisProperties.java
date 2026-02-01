package com.openframe.data.redis;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Shared Redis namespacing / key settings.
 */
@Setter
@Getter
@ConfigurationProperties(prefix = "openframe.redis")
public class OpenframeRedisProperties {

    /**
     * Global key prefix to avoid collisions with other apps using the same Redis.
     * Example: {@code of}
     */
    private String keyPrefix = "of";

    /**
     * Tenant id for namespacing keys. Mandatory (the key builder fails fast if missing).
     * - Shared services should set it to {@code shared}
     * - Tenant services should set it to the actual tenant id (e.g. via env var)
     */
    private String tenantId;

    /**
     * If true, wrap tenantId with Redis Cluster hashtag braces: {@code {tenantId}}.
     * This keeps per-tenant keys in the same hash slot when Redis Cluster is used.
     */
    private boolean tenantHashTag = true;

    private Keys keys = new Keys();

    @Setter
    @Getter
    public static class Keys {
        private String passwordResetPrefix = "pwdreset";
        private String emailVerifyPrefix = "emailverify";
        private String loginAssertPrefix = "loginassert";
        private String oauthDevTicketPrefix = "oauth:devticket";

        private String rateLimitPrefix = "rate_limit";
        private String apiKeyStatsPrefix = "stats";

        private String gatewayPrefix = "gateway";
        private String aiAgentPrefix = "ai-agent";
        private String chatChunksKeyTemplate = "chunks:%s:%s";
        private String chatLastSavedSeqKeyTemplate = "last_saved_seq:%s:%s";
        private String chatSequenceCounterKeyTemplate = "seq_counter:%s:%s";
    }
}

