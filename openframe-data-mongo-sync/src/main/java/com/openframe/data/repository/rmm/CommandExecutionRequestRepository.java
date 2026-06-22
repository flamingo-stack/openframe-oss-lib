package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.CommandExecutionRequest;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CommandExecutionRequestRepository extends MongoRepository<CommandExecutionRequest, String> {

    Optional<CommandExecutionRequest> findByMachineIdAndExecutionId(String machineId, String executionId);

    List<CommandExecutionRequest> findByExecutionId(String executionId);
}
