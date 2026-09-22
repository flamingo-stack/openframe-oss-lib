package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.software.SoftwareActionResult;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SoftwareActionResultRepository extends MongoRepository<SoftwareActionResult, String> {

    Optional<SoftwareActionResult> findByTenantIdAndId(String tenantId, String id);

    Optional<SoftwareActionResult> findByTenantIdAndExecutionId(String tenantId, String executionId);

    List<SoftwareActionResult> findByTenantIdAndBundleId(String tenantId, String bundleId);

    long countByTenantId(String tenantId);
}
