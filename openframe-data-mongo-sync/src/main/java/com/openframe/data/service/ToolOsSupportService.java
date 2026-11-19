package com.openframe.data.service;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.document.toolagent.ToolOsSupport;
import com.openframe.data.document.toolagent.UnsupportedTool;
import lombok.RequiredArgsConstructor;
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
        return integratedToolAgentService.getAllEnabled().stream()
                .filter(ToolOsSupportService::hasMinOsVersion)
                .flatMap(agent -> toolTypeOf(agent).map(type -> new AgentWithToolType(agent, type)).stream())
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
                .map(UnsupportedTool::toolType)
                .collect(Collectors.toCollection(() -> EnumSet.noneOf(ToolType.class)));
    }

    public Optional<ToolType> toolTypeOf(IntegratedToolAgent agent) {
        return integratedToolService.getToolByKey(agent.getToolId())
                .map(IntegratedTool::getToolType)
                .flatMap(ToolOsSupportService::parseToolType);
    }

    private static Stream<UnsupportedTool> unsupportedTool(Machine machine, AgentWithToolType entry) {
        IntegratedToolAgent agent = entry.agent();
        if (!ToolOsSupport.isUnsupported(machine, agent)) {
            return Stream.empty();
        }
        return ToolOsSupport.minOsVersion(agent, machine.getOsType())
                .map(minimum -> new UnsupportedTool(agent.getKey(), entry.toolType(), minimum, machine.getOsVersion()))
                .stream();
    }

    private static boolean hasMinOsVersion(IntegratedToolAgent agent) {
        return agent.getDownloadConfigurations() != null && agent.getDownloadConfigurations().stream()
                .anyMatch(configuration -> configuration.getMinOsVersion() != null);
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

    public record AgentWithToolType(IntegratedToolAgent agent, ToolType toolType) {
    }
}
