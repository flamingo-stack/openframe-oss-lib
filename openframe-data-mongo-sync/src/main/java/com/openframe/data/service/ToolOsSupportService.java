package com.openframe.data.service;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.document.toolagent.ToolOsSupport;
import com.openframe.data.document.toolagent.UnsupportedTool;
import lombok.RequiredArgsConstructor;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.integration.tool.enabled", havingValue = "true")
public class ToolOsSupportService {

    private final IntegratedToolAgentService integratedToolAgentService;
    private final IntegratedToolService integratedToolService;

    public List<AgentWithToolType> agentsWithMinOsVersion() {
        Stream<IntegratedToolAgent> withMinimum = integratedToolAgentService.getAllEnabled().stream()
                .filter(ToolOsSupport::hasMinOsVersion);
        return withToolType(withMinimum);
    }

    public List<AgentWithToolType> agentsWithToolType() {
        Stream<IntegratedToolAgent> enabled = integratedToolAgentService.getAllEnabled().stream();
        return withToolType(enabled);
    }

    private List<AgentWithToolType> withToolType(Stream<IntegratedToolAgent> agents) {
        return agents
                .flatMap(agent -> findToolType(agent).map(type -> new AgentWithToolType(agent, type)).stream())
                .toList();
    }

    public List<UnsupportedTool> unsupportedTools(Machine machine) {
        return unsupportedTools(machine, agentsWithMinOsVersion());
    }

    public List<UnsupportedTool> unsupportedTools(Machine machine, Collection<AgentWithToolType> agents) {
        return agents.stream()
                .flatMap(entry -> unsupportedTool(machine, entry))
                .toList();
    }

    public Set<ToolType> unsupportedToolTypes(Machine machine) {
        return unsupportedTools(machine).stream()
                .map(UnsupportedTool::getToolType)
                .collect(Collectors.toCollection(() -> EnumSet.noneOf(ToolType.class)));
    }

    public Optional<ToolType> findToolType(IntegratedToolAgent agent) {
        String toolId = agent.getToolId();
        if (toolId == null || toolId.isBlank()) {
            return Optional.empty();
        }
        return integratedToolService.getToolByKey(toolId)
                .map(IntegratedTool::getToolType)
                .flatMap(ToolOsSupportService::parseToolType);
    }

    private static Stream<UnsupportedTool> unsupportedTool(Machine machine, AgentWithToolType entry) {
        IntegratedToolAgent agent = entry.getAgent();
        if (!ToolOsSupport.isUnsupported(machine, agent)) {
            return Stream.empty();
        }
        return ToolOsSupport.minOsVersion(agent, machine.getOsType())
                .map(minimum -> new UnsupportedTool(agent.getKey(), entry.getToolType(), minimum, machine.getOsVersion()))
                .stream();
    }

    private static Optional<ToolType> parseToolType(String value) {
        if (value == null || value.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.of(ToolType.valueOf(value.toUpperCase(Locale.ROOT)));
        } catch (IllegalArgumentException unknown) {
            log.warn("Integrated tool type {} has no ToolType", value);
            return Optional.empty();
        }
    }

    @Value
    public static class AgentWithToolType {
        IntegratedToolAgent agent;
        ToolType toolType;
    }
}
