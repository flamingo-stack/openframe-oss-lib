package com.openframe.featureflags;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.openframe.data.document.featureflags.FeFeatureFlags;
import com.openframe.data.repository.featureflags.FeFeatureFlagsRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Resolves the effective frontend feature flags by merging DB overrides on top
 * of the yml-configured defaults. For every requested flag:
 * <ol>
 *     <li>If the per-tenant {@link FeFeatureFlags} document contains the key,
 *         that value wins.</li>
 *     <li>Otherwise the value from {@link FeFeatureFlagProperties} is used.</li>
 * </ol>
 *
 * <p>The DB lookup is cached per tenant via Caffeine with a short TTL so the
 * GraphQL query stays cheap on hot paths. The TTL is a fallback bound only:
 * callers that mutate the {@link FeFeatureFlags} document (e.g. an admin API
 * in another module) must call {@link #invalidate(String)} or
 * {@link #invalidateAll()} so the change is visible immediately instead of
 * waiting up to {@link #CACHE_TTL} for the stale entry to expire.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FeFeatureFlagService {

    private static final Duration CACHE_TTL = Duration.ofMinutes(5);

    private final FeFeatureFlagProperties properties;
    private final FeFeatureFlagsRepository repository;
    private final TenantIdProvider tenantIdProvider;

    private final Cache<String, Map<String, Boolean>> overridesCache = Caffeine.newBuilder()
            .expireAfterWrite(CACHE_TTL)
            .build();

    /**
     * Returns the effective flag map (defaults merged with DB overrides).
     * The returned map preserves the insertion order of the yml defaults and
     * appends any override-only keys at the end.
     */
    public Map<String, Boolean> getEffectiveFlags() {
        Map<String, Boolean> defaults = properties.getFeFeatureFlag();
        Map<String, Boolean> overrides = loadOverrides();
        if (overrides.isEmpty()) {
            return defaults;
        }
        Map<String, Boolean> merged = new LinkedHashMap<>(defaults);
        merged.putAll(overrides);
        return merged;
    }

    /**
     * Evicts the cached overrides for a single tenant. Must be invoked by any
     * writer of the {@link FeFeatureFlags} document (e.g. an admin API) right
     * after a successful write so the next {@link #getEffectiveFlags()} call
     * observes the change instead of serving a stale cached value for up to
     * {@link #CACHE_TTL}.
     */
    public void invalidate(String tenantId) {
        overridesCache.invalidate(tenantId);
    }

    /**
     * Evicts all cached overrides across tenants. Useful when the writer of
     * the {@link FeFeatureFlags} document cannot determine the affected
     * tenant id at write time.
     */
    public void invalidateAll() {
        overridesCache.invalidateAll();
    }

    private Map<String, Boolean> loadOverrides() {
        return overridesCache.get(tenantIdProvider.getTenantId(), key -> {
            try {
                return repository.findFirstBy()
                        .map(FeFeatureFlags::getFlags)
                        .filter(m -> !m.isEmpty())
                        .orElse(Collections.emptyMap());
            } catch (Exception e) {
                log.warn("Failed to load fe_feature_flags overrides for tenant {}: {}", key, e.getMessage());
                return Collections.emptyMap();
            }
        });
    }
}
