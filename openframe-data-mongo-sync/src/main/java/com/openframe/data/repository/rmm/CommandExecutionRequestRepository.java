package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.CommandExecutionRequest;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for {@link CommandExecutionRequest} documents — one row per
 * ({@code machineId}, {@code executionId}).
 */
@Repository
public interface CommandExecutionRequestRepository extends MongoRepository<CommandExecutionRequest, String> {

    /**
     * The unique row for one machine within one execution — the key the
     * result-correlation step uses when a single agent reports back.
     */
    Optional<CommandExecutionRequest> findByMachineIdAndExecutionId(String machineId, String executionId);

    /**
     * Every machine's row for a given batch.
     */
    List<CommandExecutionRequest> findByExecutionId(String executionId);
}
