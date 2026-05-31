package com.openframe.data.repository.version;

import com.openframe.data.document.version.ReleaseVersion;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository for ReleaseVersion document operations.
 * This repository maintains a single document representing the current release version.
 */
@Repository
public interface ReleaseVersionRepository extends MongoRepository<ReleaseVersion, String> {

    Optional<ReleaseVersion> findFirstByOrderByCreatedAtAsc();

    /** Returns the single release version for this tenant. TenantAwareMongoTemplate auto-scopes by tenantId. */
    Optional<ReleaseVersion> findFirstBy();
}

