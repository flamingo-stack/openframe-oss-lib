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
import com.openframe.data.repository.tenant.TenantRepository;
import com.openframe.data.service.OrganizationService;
import graphql.relay.Relay;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

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

    @Autowired(required = false)
    private TenantRepository tenantRepository;

    @DgsQuery
    public Object node(@InputArgument String id) {
        log.debug("Resolving node with global ID: {}", id);
        Relay.ResolvedGlobalId globalId = RELAY.fromGlobalId(id);
        return resolveNode(globalId);
    }

    @DgsQuery
    public List<Object> nodes(@InputArgument List<String> ids) {
        log.debug("Resolving {} nodes", ids.size());

        Map<String, Relay.ResolvedGlobalId> resolvedIds = new HashMap<>();
        for (String id : ids) {
            try {
                resolvedIds.put(id, RELAY.fromGlobalId(id));
            } catch (Exception e) {
                log.warn("Failed to resolve node: {}", id, e);
            }
        }

        Map<String, List<String>> idsByType = new HashMap<>();
        for (Relay.ResolvedGlobalId globalId : resolvedIds.values()) {
            idsByType.computeIfAbsent(globalId.getType(), t -> new ArrayList<>()).add(globalId.getId());
        }

        Map<String, Map<String, Object>> resultsByTypeAndId = new HashMap<>();
        for (Map.Entry<String, List<String>> entry : idsByType.entrySet()) {
            Map<String, Object> resultsById = resolveNodesBatch(entry.getKey(), entry.getValue());
            resultsByTypeAndId.put(entry.getKey(), resultsById);
        }

        List<Object> results = new ArrayList<>(ids.size());
        for (String id : ids) {
            Relay.ResolvedGlobalId globalId = resolvedIds.get(id);
            if (globalId == null) {
                results.add(null);
                continue;
            }
            Map<String, Object> resultsById = resultsByTypeAndId.get(globalId.getType());
            results.add(resultsById != null ? resultsById.get(globalId.getId()) : null);
        }
        return results;
    }

    private Map<String, Object> resolveNodesBatch(String typeName, List<String> ids) {
        NodeType nodeType;
        try {
            nodeType = NodeType.fromTypeName(typeName);
        } catch (Exception e) {
            log.warn("Unsupported node type in batch resolution: {}", typeName, e);
            return Map.of();
        }
        Map<String, Object> resultsById = new HashMap<>();
        for (String id : ids) {
            try {
                Object resolved = switch (nodeType) {
                    case MACHINE -> deviceService.findByMachineId(id).orElse(null);
                    case ORGANIZATION -> organizationService.getOrganizationByOrganizationId(id).orElse(null);
                    case INTEGRATED_TOOL -> toolService.findById(id).orElse(null);
                    case TAG -> tagService.findById(id).orElse(null);
                    case TOOL_CONNECTION -> toolConnectionService.findById(id).orElse(null);
                    case INSTALLED_AGENT -> installedAgentService.getInstalledAgent(id).orElse(null);
                    case SCRIPT -> scriptService.findById(id).orElse(null);
                    case SCRIPT_EXECUTION -> scriptExecutionService.findById(id).orElse(null);
                    case SCRIPT_SCHEDULE -> scheduleScriptService.findById(id).orElse(null);
                    case SCHEDULE_RUN -> scheduleRunService.findById(id).orElse(null);
                    case TENANT -> tenantRepository != null
                            ? tenantRepository.findById(id).orElse(null)
                            : null;
                    default -> throw new IllegalArgumentException("Unsupported node type: " + typeName);
                };
                resultsById.put(id, resolved);
            } catch (Exception e) {
                log.warn("Failed to resolve node of type {} with id {}", typeName, id, e);
                resultsById.put(id, null);
            }
        }
        return resultsById;
    }

    private Object resolveNode(Relay.ResolvedGlobalId globalId) {
        NodeType nodeType = NodeType.fromTypeName(globalId.getType());
        return switch (nodeType) {
            case MACHINE -> deviceService.findByMachineId(globalId.getId()).orElse(null);
            case ORGANIZATION -> organizationService.getOrganizationByOrganizationId(globalId.getId()).orElse(null);
            case INTEGRATED_TOOL -> toolService.findById(globalId.getId()).orElse(null);
            case TAG -> tagService.findById(globalId.getId()).orElse(null);
            case TOOL_CONNECTION -> toolConnectionService.findById(globalId.getId()).orElse(null);
            case INSTALLED_AGENT -> installedAgentService.getInstalledAgent(globalId.getId()).orElse(null);
            case SCRIPT -> scriptService.findById(globalId.getId()).orElse(null);
            case SCRIPT_EXECUTION -> scriptExecutionService.findById(globalId.getId()).orElse(null);
            case SCRIPT_SCHEDULE -> scheduleScriptService.findById(globalId.getId()).orElse(null);
            case SCHEDULE_RUN -> scheduleRunService.findById(globalId.getId()).orElse(null);
            case TENANT -> tenantRepository != null
                    ? tenantRepository.findById(globalId.getId()).orElse(null)
                    : null;
            default -> throw new IllegalArgumentException("Unsupported node type: " + globalId.getType());
        };
    }
}
