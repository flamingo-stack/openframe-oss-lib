package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.*;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.assignment.AssignedItemCount;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.mapper.GraphQLAssignmentMapper;
import com.openframe.api.service.AssignmentService;
import com.openframe.data.document.assignment.AssignmentTargetType;
import com.openframe.data.document.assignment.ItemAssignment;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.ticket.Ticket;
import graphql.relay.Relay;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@DgsComponent
@Slf4j
@Validated
@RequiredArgsConstructor
public class AssignmentDataFetcher {

    private static final Relay RELAY = new Relay();

    private final AssignmentService assignmentService;
    private final GraphQLAssignmentMapper mapper;

    @DgsQuery
    public List<AssignedItemCount> assignedItemCounts(@InputArgument @NotBlank String itemId) {
        log.debug("Fetching assigned item counts for item: {}", itemId);
        String rawItemId = RELAY.fromGlobalId(itemId).getId();
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
        String rawItemId = RELAY.fromGlobalId(itemId).getId();
        CursorPaginationCriteria pagination = mapper.toCursorPaginationCriteria(
                ConnectionArgs.builder().first(first).after(after).build());

        CountedGenericQueryResult<ItemAssignment> result =
                assignmentService.queryAssignments(rawItemId, targetType, pagination, search, sort);

        return mapper.toAssignmentConnection(result);
    }

    @DgsMutation
    public ItemAssignment assignItem(
            @InputArgument @NotBlank String itemId,
            @InputArgument AssignmentTargetType targetType,
            @InputArgument @NotBlank String targetId) {
        log.info("Assigning {} {} to item {}", targetType, targetId, itemId);
        String rawItemId = RELAY.fromGlobalId(itemId).getId();
        String rawTargetId = RELAY.fromGlobalId(targetId).getId();
        return assignmentService.assignItem(rawItemId, targetType, rawTargetId);
    }

    @DgsMutation
    public boolean unassignItem(
            @InputArgument @NotBlank String itemId,
            @InputArgument AssignmentTargetType targetType,
            @InputArgument @NotBlank String targetId) {
        log.info("Unassigning {} {} from item {}", targetType, targetId, itemId);
        String rawItemId = RELAY.fromGlobalId(itemId).getId();
        String rawTargetId = RELAY.fromGlobalId(targetId).getId();
        assignmentService.unassignItem(rawItemId, targetType, rawTargetId);
        return true;
    }

    @DgsMutation
    public boolean unassignAllByType(
            @InputArgument @NotBlank String itemId,
            @InputArgument AssignmentTargetType targetType) {
        log.info("Unassigning all {} from item {}", targetType, itemId);
        String rawItemId = RELAY.fromGlobalId(itemId).getId();
        assignmentService.unassignAllByType(rawItemId, targetType);
        return true;
    }

    @DgsData(parentType = "ItemAssignment", field = "id")
    public String itemAssignmentNodeId(DgsDataFetchingEnvironment dfe) {
        ItemAssignment assignment = dfe.getSource();
        return RELAY.toGlobalId("ItemAssignment", assignment.getId());
    }

    @DgsData(parentType = "ItemAssignment", field = "target")
    public CompletableFuture<?> resolveTarget(DgsDataFetchingEnvironment dfe) {
        ItemAssignment assignment = dfe.getSource();
        String targetId = assignment.getTargetId();
        return switch (assignment.getTargetType()) {
            case ORGANIZATION -> dfe.<String, Organization>getDataLoader("organizationDataLoader").load(targetId);
            case DEVICE -> dfe.<String, Machine>getDataLoader("machineDataLoader").load(targetId);
            case TICKET -> dfe.<String, Ticket>getDataLoader("ticketDataLoader").load(targetId);
            case KNOWLEDGE_ARTICLE -> CompletableFuture.completedFuture(null);
        };
    }
}
