package com.openframe.api.service;

import com.openframe.data.document.installedagents.InstalledAgent;
import com.openframe.data.document.tool.ConnectionStatus;
import com.openframe.data.repository.installedagents.InstalledAgentRepository;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@Slf4j
@AllArgsConstructor
public class InstalledAgentService {

    private final InstalledAgentRepository installedAgentRepository;

    public List<List<InstalledAgent>> getInstalledAgentsForMachines(List<String> machineIds) {
        log.debug("Getting installed agents for {} machines", machineIds.size());

        if (machineIds.isEmpty()) {
            return new ArrayList<>();
        }

        List<InstalledAgent> allAgents = excludeDisconnected(installedAgentRepository.findByMachineIdIn(machineIds));
        Map<String, List<InstalledAgent>> agentsByMachineId = allAgents.stream()
                .collect(Collectors.groupingBy(InstalledAgent::getMachineId));

        return machineIds.stream()
                .map(machineId -> agentsByMachineId.getOrDefault(machineId, new ArrayList<>()))
                .collect(Collectors.toList());
    }

    public List<InstalledAgent> getInstalledAgentsForMachine(String machineId) {
        log.debug("Getting installed agents for machine: {}", machineId);
        return excludeDisconnected(installedAgentRepository.findByMachineId(machineId));
    }

    public List<InstalledAgent> getAllInstalledAgents() {
        log.debug("Getting all installed agents");
        return excludeDisconnected(installedAgentRepository.findAll());
    }

    public boolean hasInstalledAgent(String id) {
        log.debug("Checking installed agent by id: {}", id);
        return installedAgentRepository.findById(id)
                .filter(this::isNotDisconnected)
                .isPresent();
    }

    public InstalledAgent getInstalledAgent(String id) {
        log.debug("Getting installed agent by id: {}", id);
        return installedAgentRepository.findById(id)
                .filter(this::isNotDisconnected)
                .orElseThrow(() -> new NoSuchElementException("Installed agent not found for id: " + id));
    }

    public boolean hasInstalledAgentByMachineIdAndType(String machineId, String agentType) {
        log.debug("Checking installed agent for machine: {} and type: {}", machineId, agentType);
        return installedAgentRepository.findByMachineIdAndAgentType(machineId, agentType)
                .filter(this::isNotDisconnected)
                .isPresent();
    }

    public InstalledAgent getInstalledAgentByMachineIdAndType(String machineId, String agentType) {
        log.debug("Getting installed agent for machine: {} and type: {}", machineId, agentType);
        return installedAgentRepository.findByMachineIdAndAgentType(machineId, agentType)
                .filter(this::isNotDisconnected)
                .orElseThrow(() -> new NoSuchElementException(
                        "Installed agent not found for machineId: " + machineId + " and agentType: " + agentType));
    }

    private List<InstalledAgent> excludeDisconnected(List<InstalledAgent> agents) {
        return agents.stream()
                .filter(this::isNotDisconnected)
                .collect(Collectors.toList());
    }

    private boolean isNotDisconnected(InstalledAgent agent) {
        return agent.getStatus() != ConnectionStatus.DISCONNECTED;
    }
}

