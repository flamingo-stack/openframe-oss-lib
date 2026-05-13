package com.openframe.api.service;

import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.repository.tool.ToolConnectionRepository;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
@Transactional(readOnly = true)
@AllArgsConstructor
public class ToolConnectionService {

    private final ToolConnectionRepository toolConnectionRepository;

    public Optional<ToolConnection> findById(String id) {
        return toolConnectionRepository.findById(id);
    }

    /**
     * Method to get tool connections for multiple machines (core logic for DataLoader)
     */
    public List<List<ToolConnection>> getToolConnectionsForMachines(List<String> machineIds) {
        log.debug("Getting tool connections for {} machines", machineIds.size());

        if (machineIds.isEmpty()) {
            return new ArrayList<>();
        }

        List<ToolConnection> allConnections = toolConnectionRepository.findByMachineIdIn(machineIds);
        Map<String, List<ToolConnection>> connectionsByMachineId = allConnections.stream()
                .collect(Collectors.groupingBy(ToolConnection::getMachineId));

        return machineIds.stream()
                .map(machineId -> connectionsByMachineId.getOrDefault(machineId, new ArrayList<>()))
                .collect(Collectors.toList());
    }

    public List<ToolConnection> getToolConnectionsForMachine(String machineId) {
        log.debug("Getting tool connections for machine: {}", machineId);
        return toolConnectionRepository.findByMachineId(machineId);
    }

    /**
     * Reverse mapping: given a list of tool-specific agent IDs (e.g. Tactical agent UUIDs,
     * Fleet host IDs as strings), return a map agentToolId → OpenFrame machineId for the given tool.
     * Missing agentToolIds are simply absent from the result map.
     */
    public Map<String, String> getMachineIdsByAgentToolIds(List<String> agentToolIds, ToolType toolType) {
        if (agentToolIds == null || agentToolIds.isEmpty()) {
            return Map.of();
        }
        List<ToolConnection> connections = toolConnectionRepository
                .findByAgentToolIdInAndToolType(agentToolIds, toolType);
        return connections.stream()
                .collect(Collectors.toMap(
                        ToolConnection::getAgentToolId,
                        ToolConnection::getMachineId,
                        (existing, replacement) -> existing));
    }
}