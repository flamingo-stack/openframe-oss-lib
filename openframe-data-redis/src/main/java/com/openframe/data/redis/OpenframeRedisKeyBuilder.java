package com.openframe.data.redis;

import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

/**
 * Centralized Redis key builder that supports global prefixing and optional tenant namespacing.
 * <p>
 * Notes:
 * - For token-based flows where tenantId is not known at read-time, prefer using an "index key"
 * (global key -> tenantId) plus a tenant-scoped key.
 */
public class OpenframeRedisKeyBuilder {

    private final OpenframeRedisProperties props;

    public OpenframeRedisKeyBuilder(OpenframeRedisProperties props) {
        this.props = props;
    }

    /**
     * Builds a key under the tenant namespace.
     * <p>
     * Tenant id is mandatory; if absent, throws IllegalStateException to fail fast.
     */
    public String tenantKey(String relativeKey) {
        return build(relativeKey, requireTenantId());
    }

    /**
     * Builds a key under an explicit tenant namespace, for multi-tenant callers (e.g. a shared
     * gateway serving many tenants) that resolve the tenant per request rather than from the
     * pod-wide {@code openframe.redis.tenant-id} property.
     *
     * @param relativeKey the relative key suffix
     * @param tenantId    the tenant to namespace under; must be non-blank
     */
    public String tenantKey(String relativeKey, String tenantId) {
        if (!StringUtils.hasText(tenantId)) {
            throw new IllegalArgumentException("tenantId must not be blank");
        }
        return build(relativeKey, tenantId.trim());
    }

    public String requireTenantId() {
        String tenantId = props.getTenantId();
        if (!StringUtils.hasText(tenantId)) {
            throw new IllegalStateException("Missing required openframe.redis.tenant-id");
        }
        return tenantId.trim();
    }

    /**
     * A helper to compute the RedisCache prefix (must include cacheName + '::').
     * Returned string is the full prefix, including global/env/tenant segments.
     */
    public String cacheKeyPrefix(String domainPrefix, String cacheName) {
        String prefix = StringUtils.hasText(domainPrefix) ? trimColons(domainPrefix) + ":" : "";
        return tenantKey(prefix + cacheName + "::");
    }

    private String build(String relativeKey, String tenantId) {
        List<String> parts = new ArrayList<>();

        String keyPrefix = trimColons(props.getKeyPrefix());
        if (StringUtils.hasText(keyPrefix)) {
            parts.add(keyPrefix);
        }

        if (StringUtils.hasText(tenantId)) {
            String t = tenantId.trim();
            parts.add(props.isTenantHashTag() ? "{" + t + "}" : t);
        }

        String rel = trimLeadingColons(relativeKey);
        if (StringUtils.hasText(rel)) {
            parts.add(rel);
        }

        return String.join(":", parts);
    }

    private static String trimColons(String value) {
        if (value == null) return null;
        String v = value.trim();
        while (v.startsWith(":")) v = v.substring(1);
        while (v.endsWith(":")) v = v.substring(0, v.length() - 1);
        return v;
    }

    private static String trimLeadingColons(String value) {
        if (value == null) return null;
        String v = value.trim();
        while (v.startsWith(":")) v = v.substring(1);
        return v;
    }
}

