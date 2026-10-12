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

// Per-tenant DB overrides win over yml defaults; results cached briefly via Caffeine to keep GraphQL reads cheap.
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

    // Merges yml defaults with DB overrides, preserving default order and appending override-only keys.
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
