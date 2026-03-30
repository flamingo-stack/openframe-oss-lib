package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.relay.NodeType;
import graphql.relay.Relay;
import com.openframe.api.service.*;
import com.openframe.data.repository.tenant.TenantRepository;
import com.openframe.data.service.OrganizationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

@DgsComponent
@RequiredArgsConstructor
@Slf4j
public class NodeDataFetcher {

    private static final Relay RELAY = new Relay();

    private final DeviceService deviceService;
    private final OrganizationService organizationService;
    private final EventService eventService;
    private final ToolService toolService;
    private final TagService tagService;
    private final ToolConnectionService toolConnectionService;
    private final InstalledAgentService installedAgentService;

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
            case MACHINE -> deviceService.findByMachineId(globalId.getId()).orElse(null);
            case ORGANIZATION -> organizationService.getOrganizationByOrganizationId(globalId.getId()).orElse(null);
            case EVENT -> eventService.findById(globalId.getId()).orElse(null);
            case INTEGRATED_TOOL -> toolService.findById(globalId.getId()).orElse(null);
            case TAG -> tagService.findById(globalId.getId()).orElse(null);
            case TOOL_CONNECTION -> toolConnectionService.findById(globalId.getId()).orElse(null);
            case INSTALLED_AGENT -> installedAgentService.getInstalledAgent(globalId.getId()).orElse(null);
            case TENANT -> tenantRepository != null
                    ? tenantRepository.findById(globalId.getId()).orElse(null)
                    : null;
            default -> throw new IllegalArgumentException("Unsupported node type: " + globalId.getType());
        };
    }
}
