package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.relay.GlobalId;
import com.openframe.api.relay.NodeType;
import com.openframe.api.service.DeviceService;
import com.openframe.api.service.EventService;
import com.openframe.api.service.ToolService;
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

    private final DeviceService deviceService;
    private final OrganizationService organizationService;
    private final EventService eventService;
    private final ToolService toolService;

    @Autowired(required = false)
    private TenantRepository tenantRepository;

    @DgsQuery
    public Object node(@InputArgument String id) {
        log.debug("Resolving node with global ID: {}", id);
        GlobalId globalId = GlobalId.decode(id);
        return resolveNode(globalId);
    }

    @DgsQuery
    public List<Object> nodes(@InputArgument List<String> ids) {
        log.debug("Resolving {} nodes", ids.size());
        return ids.stream()
                .map(id -> {
                    try {
                        GlobalId globalId = GlobalId.decode(id);
                        return resolveNode(globalId);
                    } catch (Exception e) {
                        log.warn("Failed to resolve node: {}", id, e);
                        return null;
                    }
                })
                .toList();
    }

    private Object resolveNode(GlobalId globalId) {
        NodeType nodeType = NodeType.fromTypeName(globalId.typeName());
        return switch (nodeType) {
            case MACHINE -> deviceService.findByMachineId(globalId.rawId()).orElse(null);
            case ORGANIZATION -> organizationService.getOrganizationByOrganizationId(globalId.rawId()).orElse(null);
            case EVENT -> eventService.findById(globalId.rawId()).orElse(null);
            case INTEGRATED_TOOL -> toolService.findById(globalId.rawId()).orElse(null);
            case TENANT -> tenantRepository != null
                    ? tenantRepository.findById(globalId.rawId()).orElse(null)
                    : null;
            default -> throw new IllegalArgumentException("Unsupported node type: " + globalId.typeName());
        };
    }
}
