package com.openframe.repository.tool;

import com.openframe.documents.tool.ToolConnection;
import com.openframe.documents.tool.ToolType;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ToolConnectionRepository extends MongoRepository<ToolConnection, String> {
    List<ToolConnection> findByMachineId(String machineId);

    Optional<ToolConnection> findByAgentToolId(String agentToolId);

    Optional<ToolConnection> findByMachineIdAndToolType(String machineId, ToolType toolType);
}
