package com.openframe.data.service.machine;

import com.openframe.data.document.installedagents.InstalledAgent;
import com.openframe.data.repository.installedagents.InstalledAgentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static java.util.stream.Collectors.toMap;
import static org.springframework.util.StringUtils.hasText;

// the version the openframe client runs: installed_agents, which the agent reports at registration and again after
// every update it applies. Machine.agentVersion is the version it was installed with and never moves
@Service
@RequiredArgsConstructor
public class AgentVersionService {

    public static final String OPENFRAME_CLIENT_AGENT_TYPE = "openframe-client";

    private final InstalledAgentRepository installedAgentRepository;

    public Optional<String> find(String machineId) {
        return installedAgentRepository.findByMachineIdAndAgentType(machineId, OPENFRAME_CLIENT_AGENT_TYPE)
                .map(InstalledAgent::getVersion)
                .filter(version -> hasText(version));
    }

    public Map<String, String> findAll(Collection<String> machineIds) {
        List<InstalledAgent> agents = installedAgentRepository.findByMachineIdInAndAgentType(machineIds, OPENFRAME_CLIENT_AGENT_TYPE);
        return agents.stream()
                .filter(agent -> hasText(agent.getVersion()))
                .collect(toMap(InstalledAgent::getMachineId, InstalledAgent::getVersion, (first, second) -> first));
    }
}
