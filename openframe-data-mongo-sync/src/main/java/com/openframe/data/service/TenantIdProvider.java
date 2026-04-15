package com.openframe.data.service;

import com.openframe.data.document.tenant.Tenant;
import com.openframe.data.repository.tenant.TenantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Provides the real tenant ID from MongoDB for use in Pinot shared tables.
 * Falls back to the cluster-level TENANT_ID env var for OSS or pre-registration.
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
     * Returns true if a tenant is registered in MongoDB.
     * Used to defer operations (e.g. Debezium connector creation) until a tenant exists.
     */
    public boolean isTenantRegistered() {
        return tenantRepository.count() > 0;
    }

    private Optional<Tenant> findTenant() {
        return Optional.ofNullable(tenantRepository.findAll().getFirst());
    }
}
