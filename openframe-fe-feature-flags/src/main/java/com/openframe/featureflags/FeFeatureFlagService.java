package com.openframe.featureflags;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.openframe.data.document.featureflags.FeFeatureFlags;
import com.openframe.data.repository.featureflags.FeFeatureFlagsRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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
 * GraphQL query stays cheap on hot paths.
 */
@Slf4j
@Service
public class FeFeatureFlagService {

    private static final Duration CACHE_TTL = Duration.ofMinutes(5);

    private final FeFeatureFlagProperties properties;
    private final FeFeatureFlagsRepository repository;
    private final String clusterId;

    private final Cache<String, Map<String, Boolean>> overridesCache = Caffeine.newBuilder()
            .expireAfterWrite(CACHE_TTL)
            .build();

    public FeFeatureFlagService(FeFeatureFlagProperties properties,
                                FeFeatureFlagsRepository repository,
                                @Value("${openframe.cluster-id}") String clusterId) {
        this.properties = properties;
        this.repository = repository;
        this.clusterId = clusterId;
    }

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

    private Map<String, Boolean> loadOverrides() {
        return overridesCache.get(clusterId, key -> {
            try {
                return repository.findById(key)
                        .map(FeFeatureFlags::getFlags)
                        .filter(m -> !m.isEmpty())
                        .orElse(Collections.emptyMap());
            } catch (Exception e) {
                log.warn("Failed to load fe_feature_flags overrides for cluster {}: {}", key, e.getMessage());
                return Collections.emptyMap();
            }
        });
    }
}
