package com.openframe.data.repository.tool;

import com.openframe.data.document.tool.IntegratedTool;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface IntegratedToolRepository extends MongoRepository<IntegratedTool, String>, BaseIntegratedToolRepository<Optional<IntegratedTool>, Boolean, String>, CustomIntegratedToolRepository {
    @Override
    Optional<IntegratedTool> findByType(String type);

    /**
     * @deprecated Unscoped, non-tenant-aware lookup. Per OPENFRAM-008-8, multi-tenant
     * callers MUST use {@link #findByTenantIdAndKey(String, String)} instead, as this
     * method can return another tenant's IntegratedTool document (including
     * credentials/config) when tenant-routing is enabled.
     */
    @Deprecated
    @Override
    Optional<IntegratedTool> findByKey(String key);

    Optional<IntegratedTool> findByTenantIdAndKey(String tenantId, String key);
} 
