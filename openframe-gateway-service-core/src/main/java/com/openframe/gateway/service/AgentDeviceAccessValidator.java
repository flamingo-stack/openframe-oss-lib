package com.openframe.gateway.service;

import com.openframe.data.reactive.repository.tool.ReactiveToolConnectionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

@Service
@RequiredArgsConstructor
@Slf4j
public class AgentDeviceAccessValidator {

    private final ReactiveToolConnectionRepository toolConnectionRepository;

    /**
     * Validates that the JWT machine_id is the owner of the requested agentToolId
     * via the tool_connections collection.
     */
    public Mono<Boolean> canAccess(String jwtMachineId, String agentToolId) {
        if (jwtMachineId == null || agentToolId == null || agentToolId.isBlank()) {
            log.warn("Device access denied: missing jwtMachineId={} or agentToolId={}", jwtMachineId, agentToolId);
            return Mono.just(false);
        }
        return toolConnectionRepository
                .findFirstByAgentToolIdOrderByConnectedAtDesc(agentToolId)
                .map(conn -> {
                    boolean allowed = jwtMachineId.equals(conn.getMachineId());
                    if (!allowed) {
                        log.warn("Device access denied: jwtMachineId={} tried to access agentToolId={} owned by machineId={}",
                                jwtMachineId, agentToolId, conn.getMachineId());
                    }
                    return allowed;
                })
                .defaultIfEmpty(false);
    }
}
