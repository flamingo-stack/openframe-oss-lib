package com.openframe.data.repository.tenant;

import com.openframe.data.document.tenant.Tenant;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.ReadPreference;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for Tenant documents
 */
@Repository
public interface TenantRepository extends MongoRepository<Tenant, String>, BaseTenantRepository<Optional<Tenant>, Boolean, String> {

    /**
     * Find tenant by domain
     */
    @Override
    Optional<Tenant> findByDomain(String domain);

    /** Includes newly registered workspaces when checking whether a domain is available. */
    @Override
    @ReadPreference("primary")
    Boolean existsByDomain(String domain);

    interface DomainView { String getDomain(); }

    List<DomainView> findByDomainIn(List<String> domains);

    /**
     * Count total tenants
     */
    @Override
    long count();
}
