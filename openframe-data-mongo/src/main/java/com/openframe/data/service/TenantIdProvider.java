package com.openframe.data.service;

import com.openframe.data.document.tenant.Tenant;
import com.openframe.data.repository.tenant.TenantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.ZoneOffset;
import java.util.Optional;

/**
 * Provides the real tenant ID from MongoDB for use in Pinot shared tables.
 * Falls back to the cluster-level TENANT_ID env var for OSS or pre-registration.
 * Also exposes tenant creation time for filtering stale messages from previous tenants
 * on recycled clusters.
 */
@Service
@RequiredArgsConstructor
public class TenantIdProvider {

    private final TenantRepository tenantRepository;

    @Value("${TENANT_ID:oss}")
    private String fallbackTenantId;

    public String getTenantId() {
        return findTenant()
                .map(Tenant::getId)
                .orElse(fallbackTenantId);
    }

    /**
     * Returns the current tenant's creation timestamp in epoch millis.
     * Used to filter out stale Kafka messages from a previous tenant on a recycled cluster.
     * Returns 0 if no tenant is registered (accept all messages).
     */
    public long getTenantCreatedAtMillis() {
        return findTenant()
                .map(Tenant::getCreatedAt)
                .map(createdAt -> createdAt.toInstant(ZoneOffset.UTC).toEpochMilli())
                .orElse(0L);
    }

    private Optional<Tenant> findTenant() {
        return tenantRepository.findAll().stream().findFirst();
    }
}
