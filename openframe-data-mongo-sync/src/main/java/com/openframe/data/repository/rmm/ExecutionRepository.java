package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.Execution;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository for {@link Execution} rows in the History list.
 *
 * <p>Cursor-paged listing lives inline in {@code ExecutionService} via
 * {@code MongoTemplate} — the predicate is just {@code tenantId + scriptId},
 * not worth a Custom repository split.
 */
@Repository
public interface ExecutionRepository extends MongoRepository<Execution, String> {

    Optional<Execution> findByTenantIdAndExecutionId(String tenantId, String executionId);
}
