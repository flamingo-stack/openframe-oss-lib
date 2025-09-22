package com.openframe.api.service;

import com.openframe.data.document.tool.ToolConnection;
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
}