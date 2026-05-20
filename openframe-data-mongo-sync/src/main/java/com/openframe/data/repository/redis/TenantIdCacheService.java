package com.openframe.data.repository.redis;

import com.openframe.data.document.tenant.Tenant;
import com.openframe.data.repository.tenant.TenantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

/**
 * Cache-fronted tenant validation. Follows the same Spring Cache pattern as
 * {@link MachineIdCacheService}: returns {@code null} when the tenant does not
 * exist, and {@code unless = "#result == null"} keeps misses out of the cache
 * so unknown tenant ids retry on the next event.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "openframe.tenant-id.cache.enabled", havingValue = "true")
public class TenantIdCacheService {

    private final TenantRepository tenantRepository;

    /**
     * @param tenantId tenant identifier carried by an integrated-tool event
     * @return canonical tenant id when the tenant exists, {@code null} otherwise
     */
    @Cacheable(value = "tenantCache", key = "#tenantId", unless = "#result == null")
    public String getTenantId(String tenantId) {
        log.debug("Fetching tenant for id: {}", tenantId);
        try {
            return tenantRepository.findByDomain(tenantId)
                    .map(Tenant::getId)
                    .orElse(null);
        } catch (Exception e) {
            log.error("Error fetching tenant for id: {}", tenantId, e);
            return null;
        }
    }
}
