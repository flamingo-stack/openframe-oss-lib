package com.openframe.data.repository.auth;

import com.openframe.data.document.auth.Tenant;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for Tenant documents
 */
@Repository
public interface TenantRepository extends MongoRepository<Tenant, String> {

    /**
     * Find tenant by domain
     */
    Optional<Tenant> findByDomain(String domain);

    /**
     * Check if domain exists
     */
    boolean existsByDomain(String domain);


    interface DomainView { String getDomain(); }

    List<DomainView> findByDomainIn(List<String> domains);
    /**
     * Count total tenants
     */
    @Override
    long count();
}