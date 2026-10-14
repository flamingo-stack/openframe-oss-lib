package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.relay.FederatedNodeReference;
import com.openframe.api.relay.FederatedNodeTypes;
import com.openframe.graphql.relay.InvalidRelayIdException;
import com.openframe.graphql.relay.NodeType;
import com.openframe.graphql.relay.ParsedRelayId;
import com.openframe.graphql.relay.RelayIdCodec;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.InstalledAgentService;
import com.openframe.api.service.TagService;
import com.openframe.api.service.ToolConnectionService;
import com.openframe.api.service.ToolService;
import com.openframe.api.service.rmm.schedule.ScheduleRunService;
import com.openframe.api.service.rmm.script.ScriptExecutionService;
import com.openframe.api.service.rmm.schedule.ScheduleScriptService;
import com.openframe.api.service.rmm.script.ScriptService;
import com.openframe.api.service.ticket.TicketService;
import com.openframe.api.service.rmm.software.SoftwareBundleService;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.repository.tenant.TenantRepository;
import com.openframe.data.service.OrganizationService;
import com.openframe.security.authentication.AuthPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.util.List;
import java.util.Optional;

@DgsComponent
@RequiredArgsConstructor
@Slf4j
public class NodeDataFetcher {

    private static final String INVALID_NODE_ID = "Invalid node id";

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
    private final ObjectProvider<TenantRepository> tenantRepository;
    private final ObjectProvider<SoftwareBundleService> softwareBundleService;
    private final RelayIdCodec relayIdCodec;
    private final ObjectProvider<TicketService> ticketService;
    private final ObjectProvider<FederatedNodeTypes> federatedNodeTypes;

    @DgsQuery
    public Object node(@InputArgument String id, @AuthenticationPrincipal AuthPrincipal principal) {
        log.debug("Resolving node with global ID: {}", id);
        ParsedRelayId globalId = parseNodeId(id);
        return resolveNode(globalId, principal);
    }

    @DgsQuery
    public List<Object> nodes(@InputArgument List<String> ids, @AuthenticationPrincipal AuthPrincipal principal) {
        log.debug("Resolving {} nodes", ids.size());
        return ids.stream()
                .map(id -> resolveNodeOrNull(id, principal))
                .toList();
    }

    private Object resolveNodeOrNull(String id, AuthPrincipal principal) {
        try {
            ParsedRelayId globalId = parseNodeId(id);
            return resolveNode(globalId, principal);
        } catch (RuntimeException e) {
            log.warn("Failed to resolve node: {}", id, e);
            return null;
        }
    }

    private ParsedRelayId parseNodeId(String id) {
        return relayIdCodec.parse(id)
                .orElseThrow(() -> new InvalidRelayIdException(INVALID_NODE_ID));
    }

    private Object resolveNode(ParsedRelayId globalId, AuthPrincipal principal) {
        String typeName = globalId.getTypeName();
        String rawId = globalId.getRawId();
        NodeType nodeType = NodeType.fromTypeName(typeName);
        if (isFederated(nodeType)) {
            return new FederatedNodeReference(typeName, rawId);
        }
        return switch (nodeType) {
            case MACHINE -> deviceService.findByMachineId(rawId).orElse(null);
            case ORGANIZATION -> organizationService.getOrganizationByOrganizationId(rawId).orElse(null);
            case INTEGRATED_TOOL -> toolService.findById(rawId).orElse(null);
            case TAG -> tagService.findById(rawId).orElse(null);
            case TOOL_CONNECTION -> toolConnectionService.findById(rawId).orElse(null);
            case INSTALLED_AGENT -> installedAgentService.getInstalledAgent(rawId).orElse(null);
            case SCRIPT -> scriptService.findById(rawId).orElse(null);
            case SCRIPT_EXECUTION -> scriptExecutionService.findById(rawId).orElse(null);
            case SCRIPT_SCHEDULE -> scheduleScriptService.findById(rawId).orElse(null);
            case SCHEDULE_RUN -> scheduleRunService.findById(rawId).orElse(null);
            case TENANT -> Optional.ofNullable(tenantRepository.getIfAvailable())
                    .flatMap(repo -> repo.findById(rawId))
                    .orElse(null);
            case SOFTWARE_BUNDLE -> Optional.ofNullable(softwareBundleService.getIfAvailable())
                    .flatMap(service -> service.findById(rawId))
                    .orElse(null);
            case TICKET -> findTicket(principal, rawId);
            default -> throw new IllegalArgumentException("Unsupported node type: " + typeName);
        };
    }

    private boolean isFederated(NodeType nodeType) {
        FederatedNodeTypes federated = federatedNodeTypes.getIfAvailable();
        return Optional.ofNullable(federated)
                .map(FederatedNodeTypes::types)
                .filter(types -> types.contains(nodeType))
                .isPresent();
    }

    private Ticket findTicket(AuthPrincipal principal, String rawId) {
        TicketService service = ticketService.getIfAvailable();
        return Optional.ofNullable(service)
                .flatMap(lookup -> lookup.getTicket(principal, rawId))
                .orElse(null);
    }
}
