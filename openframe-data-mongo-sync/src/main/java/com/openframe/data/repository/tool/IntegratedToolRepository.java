package com.openframe.data.repository.tool;

import com.openframe.data.document.tool.IntegratedTool;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface IntegratedToolRepository extends MongoRepository<IntegratedTool, String>, BaseIntegratedToolRepository<Optional<IntegratedTool>, Boolean, String>, CustomIntegratedToolRepository {
    /**
     * @deprecated Unscoped lookup. In a multi-tenant context this can return an
     * IntegratedTool (and its credentials) belonging to another tenant. Use
     * {@link #findByTenantIdAndKey(String, String)} instead.
     */
    @Deprecated
    @Override
    Optional<IntegratedTool> findByType(String type);

    /**
     * @deprecated Unscoped lookup. In a multi-tenant context this can return an
     * IntegratedTool (and its credentials) belonging to another tenant. Use
     * {@link #findByTenantIdAndKey(String, String)} instead.
     */
    @Deprecated
    @Override
    Optional<IntegratedTool> findByKey(String key);

    Optional<IntegratedTool> findByTenantIdAndKey(String tenantId, String key);
} 
