package com.openframe.repository.sso;

import com.openframe.documents.sso.SSOPerTenantConfig;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SSOPerTenantConfigRepository extends MongoRepository<SSOPerTenantConfig, String> {

    Optional<SSOPerTenantConfig> findByTenantIdAndProvider(String tenantId, String provider);

    List<SSOPerTenantConfig> findByTenantIdAndEnabledTrue(String tenantId);
}