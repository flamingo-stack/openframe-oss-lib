package com.openframe.data.repository.cluster;

import com.openframe.data.document.cluster.ClusterRegistration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository for ClusterRegistration document operations.
 * This repository maintains a single document representing the current cluster registration.
 */
@Repository
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public interface ClusterRegistrationRepository extends MongoRepository<ClusterRegistration, String> {

    /**
     * Find the first (and should be only) cluster registration document
     * @return Optional containing the cluster registration if found
     */
    Optional<ClusterRegistration> findFirstByOrderByCreatedAtAsc();
}

