package com.openframe.data.repository.tenant;

import com.openframe.data.document.tenant.Tenant;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.mongodb.repository.Update;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
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

    /**
     * Check if domain exists
     */
    @Override
    Boolean existsByDomain(String domain);

    boolean existsByDisplayId(String displayId);

    /**
     * Sets the tenant's name, website and updatedAt and nothing else. Use it instead of a load-and-save: a save
     * replaces the whole shared document with the caller's view of it, dropping every field the caller's lib does
     * not know yet (such as displayId). Returns the number of tenants updated: 1, or 0 for an unknown id (updatedAt
     * always changes, so a matched tenant is always updated).
     */
    @Query("{ '_id': ?0 }")
    @Update("{ '$set': { 'name': ?1, 'website': ?2, 'updatedAt': ?3 } }")
    long updateProfile(String tenantId, String name, String website, LocalDateTime updatedAt);

    interface DomainView { String getDomain(); }

    List<DomainView> findByDomainIn(List<String> domains);

    /**
     * Count total tenants
     */
    @Override
    long count();
}