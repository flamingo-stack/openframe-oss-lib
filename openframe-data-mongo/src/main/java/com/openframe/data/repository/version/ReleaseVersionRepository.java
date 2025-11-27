package com.openframe.data.repository.version;

import com.openframe.data.document.version.ReleaseVersion;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository for ReleaseVersion document operations.
 * This repository maintains a single document representing the current release version.
 */
@Repository
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public interface ReleaseVersionRepository extends MongoRepository<ReleaseVersion, String> {

    /**
     * Find the first (and should be only) release version document
     * @return Optional containing the release version if found
     */
    Optional<ReleaseVersion> findFirstByOrderByCreatedAtAsc();
}

