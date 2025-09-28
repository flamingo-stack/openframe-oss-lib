package com.openframe.data.repository.tenant;

import com.openframe.data.document.tenant.Tenant;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for Tenant documents
 */
@Repository
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public interface TenantRepository extends MongoRepository<Tenant, String>, BaseTenantRepository<Optional<Tenant>, Boolean, String> {

    /**
     * Find tenant by domain
     */
    @Override
    Optional<Tenant> findByDomain(String domain);

    /**
     * Check if domain exists
     */
    @Override
    Boolean existsByDomain(String domain);

    interface DomainView { String getDomain(); }

    List<DomainView> findByDomainIn(List<String> domains);

    /**
     * Count total tenants
     */
    @Override
    long count();
}