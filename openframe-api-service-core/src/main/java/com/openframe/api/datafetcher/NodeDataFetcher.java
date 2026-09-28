package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.relay.NodeType;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.InstalledAgentService;
import com.openframe.api.service.TagService;
import com.openframe.api.service.ToolConnectionService;
import com.openframe.api.service.ToolService;
import com.openframe.api.service.rmm.schedule.ScheduleRunService;
import com.openframe.api.service.rmm.script.ScriptExecutionService;
import com.openframe.api.service.rmm.schedule.ScheduleScriptService;
import com.openframe.api.service.rmm.script.ScriptService;
import com.openframe.api.service.rmm.software.SoftwareBundleService;
import com.openframe.data.repository.tenant.TenantRepository;
import com.openframe.data.service.OrganizationService;
import graphql.relay.Relay;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.util.List;
import java.util.Optional;

@DgsComponent
@RequiredArgsConstructor
@Slf4j
public class NodeDataFetcher {

    private static final Relay RELAY = new Relay();

    private final DeviceService deviceService;
    private final OrganizationService organizationService;
    private final ToolService toolService;
    private final TagService tagService;
    private final ToolConnectionService toolConnectionService;
    private final InstalledAgentService installedAgentService;
    private final ScriptService scriptService;
    private final ScriptExecutionService scriptExecutionService;
    private final ScheduleScriptService scheduleScriptService;
    private final ScheduleRunService scheduleRunService;
    private final Optional<TenantRepository> tenantRepository;
    private final Optional<SoftwareBundleService> softwareBundleService;

    @DgsQuery
    public Object node(@InputArgument String id) {
        log.debug("Resolving node with global ID: {}", id);
        Relay.ResolvedGlobalId globalId = RELAY.fromGlobalId(id);
        return resolveNode(globalId);
    }

    @DgsQuery
    public List<Object> nodes(@InputArgument List<String> ids) {
        log.debug("Resolving {} nodes", ids.size());
        return ids.stream()
                .map(id -> {
                    try {
                        Relay.ResolvedGlobalId globalId = RELAY.fromGlobalId(id);
                        return resolveNode(globalId);
                    } catch (Exception e) {
                        log.warn("Failed to resolve node: {}", id, e);
                        return null;
                    }
                })
                .toList();
    }

    private Object resolveNode(Relay.ResolvedGlobalId globalId) {
        NodeType nodeType = NodeType.fromTypeName(globalId.getType());
        return switch (nodeType) {
            case MACHINE -> deviceService.findByMachineId(globalId.getId())
                    .orElseThrow(() -> nodeNotFound(globalId));
            case ORGANIZATION -> organizationService.getOrganizationByOrganizationId(globalId.getId())
                    .orElseThrow(() -> nodeNotFound(globalId));
            case INTEGRATED_TOOL -> toolService.findById(globalId.getId())
                    .orElseThrow(() -> nodeNotFound(globalId));
            case TAG -> tagService.findById(globalId.getId())
                    .orElseThrow(() -> nodeNotFound(globalId));
            case TOOL_CONNECTION -> toolConnectionService.findById(globalId.getId())
                    .orElseThrow(() -> nodeNotFound(globalId));
            case INSTALLED_AGENT -> installedAgentService.getInstalledAgent(globalId.getId())
                    .orElseThrow(() -> nodeNotFound(globalId));
            case SCRIPT -> scriptService.findById(globalId.getId())
                    .orElseThrow(() -> nodeNotFound(globalId));
            case SCRIPT_EXECUTION -> scriptExecutionService.findById(globalId.getId())
                    .orElseThrow(() -> nodeNotFound(globalId));
            case SCRIPT_SCHEDULE -> scheduleScriptService.findById(globalId.getId())
                    .orElseThrow(() -> nodeNotFound(globalId));
            case SCHEDULE_RUN -> scheduleRunService.findById(globalId.getId())
                    .orElseThrow(() -> nodeNotFound(globalId));
            case TENANT -> tenantRepository
                    .orElseThrow(() -> serviceNotConfigured(nodeType))
                    .findById(globalId.getId())
                    .orElseThrow(() -> nodeNotFound(globalId));
            case SOFTWARE_BUNDLE -> softwareBundleService
                    .orElseThrow(() -> serviceNotConfigured(nodeType))
                    .findById(globalId.getId())
                    .orElseThrow(() -> nodeNotFound(globalId));
            default -> throw new IllegalArgumentException("Unsupported node type: " + globalId.getType());
        };
    }

    private static IllegalStateException nodeNotFound(Relay.ResolvedGlobalId globalId) {
        return new IllegalStateException("Node not found for type " + globalId.getType() + " and id " + globalId.getId());
    }

    private static IllegalStateException serviceNotConfigured(NodeType nodeType) {
        return new IllegalStateException("No service configured to resolve node type: " + nodeType);
    }
}

