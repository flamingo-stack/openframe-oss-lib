package com.openframe.data.repository.tool;

import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.tool.ToolType;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ToolConnectionRepository extends MongoRepository<ToolConnection, String> {
    List<ToolConnection> findByMachineId(String machineId);
    
    List<ToolConnection> findByMachineIdIn(List<String> machineIds);

    Optional<ToolConnection> findByAgentToolId(String agentToolId);

    Optional<ToolConnection> findByMachineIdAndToolType(String machineId, ToolType toolType);
}
