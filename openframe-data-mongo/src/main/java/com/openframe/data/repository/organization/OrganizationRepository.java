package com.openframe.data.repository.organization;

import com.openframe.data.document.organization.Organization;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Repository for Organization document operations.
 * Provides standard CRUD operations and custom queries for organizations.
 */
@Repository
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public interface OrganizationRepository extends MongoRepository<Organization, String>, CustomOrganizationRepository {

    /**
     * Find organization by organizationId
     * @param organizationId unique organization identifier
     * @return Optional containing the organization if found
     */
    Optional<Organization> findByOrganizationId(String organizationId);

    /**
     * Find organizations by organizationIds (for batch loading)
     * @param organizationIds collection of organization identifiers (can be Set or List)
     * @return list of organizations
     */
    List<Organization> findByOrganizationIdIn(Set<String> organizationIds);
}

