package com.openframe.data.reactive.repository.tool;

import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.tool.ToolType;
import org.springframework.data.mongodb.repository.ReactiveMongoRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;

@Repository
public interface ReactiveToolConnectionRepository extends ReactiveMongoRepository<ToolConnection, String> {

    Mono<ToolConnection> findByMachineIdAndToolType(String machineId, ToolType toolType);

    Mono<ToolConnection> findFirstByAgentToolIdOrderByConnectedAtDesc(String agentToolId);
}
