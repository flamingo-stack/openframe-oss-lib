package com.openframe.data.service;

import com.openframe.data.document.tenant.Tenant;
import com.openframe.data.repository.tenant.TenantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Provides the real tenant ID from MongoDB for use in Pinot shared tables.
 * Falls back to the cluster-level TENANT_ID env var for OSS or pre-registration.
 *
 * In-memory cache: once a tenant is found, it's cached for the pod's lifetime.
 * Safe because there is exactly one tenant per cluster and it doesn't change
 * while the pod is alive (cluster recycling destroys the pod).
 * Pre-registration calls keep hitting MongoDB until a tenant appears, then cache forever.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TenantIdProvider {

    private final TenantRepository tenantRepository;

    @Value("${TENANT_ID:oss}")
    private String fallbackTenantId;

    private Tenant cachedTenant;
    private boolean fallbackLogged;

    public String getTenantId() {
        Tenant tenant = getCachedTenant();
        if (tenant != null) {
            return tenant.getId();
        }
        if (!fallbackLogged) {
            log.warn("TenantIdProvider: no tenant found in MongoDB, falling back to TENANT_ID={}", fallbackTenantId);
            fallbackLogged = true;
        }
        return fallbackTenantId;
    }

    /**
     * Returns true if a tenant is registered in MongoDB.
     * Used to defer operations (e.g. Debezium connector creation) until a tenant exists.
     */
    public boolean isTenantRegistered() {
        return getCachedTenant() != null;
    }

    /**
     * Returns the cached tenant, falling back to a MongoDB query if no cache is populated.
     * Caches the tenant permanently on first successful find — the tenant doesn't change
     * during pod lifetime.
     */
    private Tenant getCachedTenant() {
        Tenant tenant = cachedTenant;
        if (tenant != null) {
            return tenant;
        }
        List<Tenant> tenants = tenantRepository.findAll();
        if (tenants.isEmpty()) {
            return null;
        }
        tenant = tenants.getFirst();
        cachedTenant = tenant;
        log.info("TenantIdProvider: cached tenant from MongoDB id={} name={}", tenant.getId(), tenant.getName());
        return tenant;
    }
}
