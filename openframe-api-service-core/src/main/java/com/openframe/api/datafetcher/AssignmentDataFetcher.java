package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.*;
import com.openframe.api.dataloader.OrganizationDataLoader;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.assignment.AssignedItemCount;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.mapper.GraphQLAssignmentMapper;
import com.openframe.api.dataloader.TicketStatusDefinitionDataLoader;
import com.openframe.graphql.relay.NodeType;
import com.openframe.graphql.relay.RelayIdCodec;
import com.openframe.api.service.AssignmentService;
import com.openframe.data.document.assignment.AssignmentItemType;
import com.openframe.data.document.assignment.AssignmentTargetType;
import com.openframe.data.document.assignment.ItemAssignment;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketStatusDefinition;
import com.openframe.data.document.ticket.TicketStatusKind;
import com.openframe.data.document.ticket.TicketStatus;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;

import java.util.Collections;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.dataloader.DataLoader;

import java.util.concurrent.CompletableFuture;

@DgsComponent
@Slf4j
@Validated
@RequiredArgsConstructor
public class AssignmentDataFetcher {

    private static final Set<NodeType> ASSIGNABLE_ITEM_TYPES =
            EnumSet.of(NodeType.TICKET, NodeType.KNOWLEDGE_BASE_ITEM, NodeType.INSIGHT);
    private static final Map<AssignmentItemType, NodeType> ITEM_NODE_TYPES = itemNodeTypes();
    private static final Map<AssignmentTargetType, NodeType> TARGET_NODE_TYPES = targetNodeTypes();

    private final AssignmentService assignmentService;
    private final GraphQLAssignmentMapper mapper;
    private final RelayIdCodec relayIdCodec;

    @DgsQuery
    public List<AssignedItemCount> assignedItemCounts(@InputArgument @NotBlank String itemId) {
        log.debug("Fetching assigned item counts for item: {}", itemId);
        String rawItemId = decodeAssignableItemId(itemId);
        Map<AssignmentTargetType, Long> counts = assignmentService.countAssignmentsByTargetType(rawItemId);
        return mapper.toAssignedItemCounts(counts);
    }

    @DgsQuery
    public CountedGenericConnection<GenericEdge<ItemAssignment>> assignedItems(
            @InputArgument @NotBlank String itemId,
            @InputArgument AssignmentTargetType targetType,
            @InputArgument String search,
            @InputArgument SortInput sort,
            @InputArgument Integer first,
            @InputArgument String after) {
        log.debug("Fetching assigned items for item: {}, targetType: {}, search: {}, sort: {}, first: {}, after: {}",
                itemId, targetType, search, sort, first, after);
        String rawItemId = decodeAssignableItemId(itemId);
        CursorPaginationCriteria pagination = mapper.toCursorPaginationCriteria(
                ConnectionArgs.builder().first(first).after(after).build());

        CountedGenericQueryResult<ItemAssignment> result =
                assignmentService.queryAssignments(rawItemId, targetType, pagination, search, sort);

        return mapper.toAssignmentConnection(result);
    }

    @DgsMutation
    public ItemAssignment assignItem(
            @InputArgument @NotBlank String itemId,
            @InputArgument AssignmentItemType itemType,
            @InputArgument AssignmentTargetType targetType,
            @InputArgument @NotBlank String targetId) {
        log.info("Assigning {} {} to {} {}", targetType, targetId, itemType, itemId);
        String rawItemId = decodeItemId(itemId, itemType);
        String rawTargetId = decodeTargetId(targetId, targetType);
        return assignmentService.assignItem(rawItemId, itemType, targetType, rawTargetId);
    }

    @DgsMutation
    public boolean unassignItem(
            @InputArgument @NotBlank String itemId,
            @InputArgument AssignmentTargetType targetType,
            @InputArgument @NotBlank String targetId) {
        log.info("Unassigning {} {} from item {}", targetType, targetId, itemId);
        String rawItemId = decodeAssignableItemId(itemId);
        String rawTargetId = decodeTargetId(targetId, targetType);
        assignmentService.unassignItem(rawItemId, targetType, rawTargetId);
        return true;
    }

    @DgsMutation
    public boolean unassignAllByType(
            @InputArgument @NotBlank String itemId,
            @InputArgument AssignmentTargetType targetType) {
        log.info("Unassigning all {} from item {}", targetType, itemId);
        String rawItemId = decodeAssignableItemId(itemId);
        assignmentService.unassignAllByType(rawItemId, targetType);
        return true;
    }

    /**
     * The legacy status, kept for clients built before the lifecycle rollout — the mobile and
     * desktop shells ship a frozen web bundle. Nothing stores it any more, so it is derived from
     * the lifecycle kind; this schema exposes no kind of its own.
     * TODO(lifecycle-rollout): drop once no released shell reads it.
     */
    @DgsData(parentType = "Ticket", field = "status")
    public String ticketLegacyStatus(DgsDataFetchingEnvironment dfe) {
        Ticket ticket = dfe.getSource();
        return TicketStatus.fromKind(ticket.getStatusKind()).name();
    }

    /**
     * The lifecycle status drives the chip the assigned-ticket lists render: the kind selects the
     * canonical styling, and a custom column takes its name and colour from the definition. The
     * legacy string next to it cannot stand in — it reports every custom column as TECH_REQUIRED.
     */
    @DgsData(parentType = "Ticket", field = "statusKind")
    public TicketStatusKind ticketStatusKind(DgsDataFetchingEnvironment dfe) {
        Ticket ticket = dfe.getSource();
        return ticket.getStatusKind();
    }

    @DgsData(parentType = "Ticket", field = "statusDefinition")
    public CompletableFuture<TicketStatusDefinition> ticketStatusDefinition(DgsDataFetchingEnvironment dfe) {
        Ticket ticket = dfe.getSource();
        String statusId = ticket.getStatusId();
        if (statusId == null || statusId.isBlank()) {
            return CompletableFuture.completedFuture(null);
        }
        DataLoader<String, TicketStatusDefinition> loader =
                dfe.getDataLoader(TicketStatusDefinitionDataLoader.NAME);
        return loader.load(statusId);
    }

    @DgsData(parentType = "ItemAssignment", field = "target")
    public CompletableFuture<?> resolveTarget(DgsDataFetchingEnvironment dfe) {
        ItemAssignment assignment = dfe.getSource();
        String targetId = assignment.getTargetId();
        return switch (assignment.getTargetType()) {
            case ORGANIZATION -> dfe.<String, Organization>getDataLoader(OrganizationDataLoader.NAME).load(targetId);
            case DEVICE -> dfe.<String, Machine>getDataLoader("machineDataLoader").load(targetId);
            case TICKET -> dfe.<String, Ticket>getDataLoader("ticketDataLoader").load(targetId);
            case KNOWLEDGE_ARTICLE -> dfe.<String, KnowledgeBaseItem>getDataLoader("knowledgeBaseItemDataLoader").load(targetId);
        };
    }

    private String decodeAssignableItemId(String itemId) {
        return relayIdCodec.decodeOneOf(itemId, ASSIGNABLE_ITEM_TYPES);
    }

    private String decodeItemId(String itemId, AssignmentItemType itemType) {
        NodeType expected = ITEM_NODE_TYPES.get(itemType);
        return relayIdCodec.decode(itemId, expected);
    }

    private String decodeTargetId(String targetId, AssignmentTargetType targetType) {
        NodeType expected = TARGET_NODE_TYPES.get(targetType);
        return relayIdCodec.decode(targetId, expected);
    }

    private static Map<AssignmentItemType, NodeType> itemNodeTypes() {
        Map<AssignmentItemType, NodeType> types = new EnumMap<>(AssignmentItemType.class);
        types.put(AssignmentItemType.TICKET, NodeType.TICKET);
        types.put(AssignmentItemType.KNOWLEDGE_ARTICLE, NodeType.KNOWLEDGE_BASE_ITEM);
        types.put(AssignmentItemType.INSIGHT, NodeType.INSIGHT);
        return Collections.unmodifiableMap(types);
    }

    private static Map<AssignmentTargetType, NodeType> targetNodeTypes() {
        Map<AssignmentTargetType, NodeType> types = new EnumMap<>(AssignmentTargetType.class);
        types.put(AssignmentTargetType.ORGANIZATION, NodeType.ORGANIZATION);
        types.put(AssignmentTargetType.DEVICE, NodeType.MACHINE);
        types.put(AssignmentTargetType.TICKET, NodeType.TICKET);
        types.put(AssignmentTargetType.KNOWLEDGE_ARTICLE, NodeType.KNOWLEDGE_BASE_ITEM);
        return Collections.unmodifiableMap(types);
    }
}
