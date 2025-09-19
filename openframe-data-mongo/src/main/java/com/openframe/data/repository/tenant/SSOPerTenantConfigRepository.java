package com.openframe.data.repository.tenant;

import com.openframe.data.document.tenant.SSOPerTenantConfig;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SSOPerTenantConfigRepository extends MongoRepository<SSOPerTenantConfig, String> {
    List<SSOPerTenantConfig> findByTenantIdAndEnabledTrue(String tenantId);

    Optional<SSOPerTenantConfig> findByProvider(String provider);

    Optional<SSOPerTenantConfig> findFirstByTenantIdAndProviderAndEnabledTrue(String tenantId, String provider);
}