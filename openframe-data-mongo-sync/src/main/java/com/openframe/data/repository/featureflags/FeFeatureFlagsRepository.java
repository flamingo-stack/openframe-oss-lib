package com.openframe.data.repository.featureflags;

import com.openframe.data.document.featureflags.FeFeatureFlags;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface FeFeatureFlagsRepository extends MongoRepository<FeFeatureFlags, String> {

    /**
     * Returns the current tenant's overrides document, if any. Since
     * {@link FeFeatureFlags} is {@code TenantScoped}, the tenant aspect injects
     * the {@code tenantId} criterion automatically, so this resolves to the
     * single document belonging to the running pod's tenant.
     */
    Optional<FeFeatureFlags> findFirstBy();
}
