package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.software.SoftwareActionRun;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SoftwareActionRunRepository extends MongoRepository<SoftwareActionRun, String> {

    Optional<SoftwareActionRun> findByTenantIdAndId(String tenantId, String id);

    Optional<SoftwareActionRun> findByTenantIdAndExecutionId(String tenantId, String executionId);

    long countByTenantId(String tenantId);
}
