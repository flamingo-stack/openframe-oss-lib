package com.openframe.api.datafetcher.rmm;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsData;
import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.rmm.execution.ScriptExecutionFilterInput;
import com.openframe.api.dto.rmm.execution.ScriptExecutionFilters;
import com.openframe.api.dto.rmm.execution.ScriptExecutionResponse;
import com.openframe.api.dto.rmm.script.ScriptFilterOption;
import com.openframe.api.dto.rmm.script.ScriptResponse;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.api.mapper.GraphQLScriptExecutionMapper;
import com.openframe.api.service.rmm.script.ScriptExecutionFilterService;
import com.openframe.api.service.rmm.script.ScriptExecutionService;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.filter.ExecutionOwnerScope;
import graphql.relay.Relay;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dataloader.DataLoader;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Pattern;

/**
 * GraphQL resolver for the Execution History tab — the same handler backs both the
 * per-script variant ({@code scriptExecutions}) and the per-schedule variant
 * ({@code scheduleExecutions}), since {@link ExecutionOwnerScope} lets a single
 * service call cover both. Field resolvers on {@code ScriptExecution} live here too
 * so they aren't duplicated between the two views.
 *
 * <p>Tenant scoping is delegated to {@link ScriptExecutionService} via
 * {@code TenantIdProvider}.
 *
 * <p>{@code Execution.initiator} is resolved via the shared {@code userDataLoader},
 * batching User lookups across all rows in the page — same pattern as
 * {@code Script.author}. {@code Execution.scriptName} is resolved the same way via
 * {@code scriptDataLoader}, rather than being snapshotted onto the document.
 */
@DgsComponent
@RequiredArgsConstructor
@Slf4j
public class ScriptExecutionDataFetcher {

    private static final Relay RELAY = new Relay();
    private static final Pattern RAW_MONGO_OBJECT_ID = Pattern.compile("^[0-9a-fA-F]{24}$");

    private final ScriptExecutionService scriptExecutionService;
    private final ScriptExecutionFilterService scriptExecutionFilterService;
    private final GraphQLScriptExecutionMapper executionMapper;

    /** Relay global id (Base64 "ScriptExecution:&lt;rawId&gt;") for the {@code id} field — the opaque node handle. */
    @DgsData(parentType = "ScriptExecution", field = "id")
    public String scriptExecutionNodeId(DgsDataFetchingEnvironment dfe) {
        ScriptExecutionResponse execution = dfe.getSource();
        return RELAY.toGlobalId("ScriptExecution", execution.getId());
    }

    /** Single execution by its (Relay-encoded) id — the typed alternative to a {@code node(id)} refetch. */
    @DgsQuery
    public ScriptExecutionResponse scriptExecution(@InputArgument @NotBlank String id) {
        return scriptExecutionService.get(decodeId(id));
    }

    @DgsQuery
    public CountedGenericConnection<GenericEdge<ScriptExecutionResponse>> scriptExecutions(
            @InputArgument @NotBlank String scriptId,
            @InputArgument @Valid ScriptExecutionFilterInput filter,
            @InputArgument String search,
            @InputArgument @Valid SortInput sort,
            @InputArgument Integer first,
            @InputArgument String after,
            @InputArgument Integer last,
            @InputArgument String before) {
        return listExecutions(ExecutionOwnerScope.forScript(decodeId(scriptId)),
                filter, search, sort, first, after, last, before);
    }

    @DgsQuery
    public CountedGenericConnection<GenericEdge<ScriptExecutionResponse>> scheduleExecutions(
            @InputArgument @NotBlank String scheduleId,
            @InputArgument @Valid ScriptExecutionFilterInput filter,
            @InputArgument String search,
            @InputArgument @Valid SortInput sort,
            @InputArgument Integer first,
            @InputArgument String after,
            @InputArgument Integer last,
            @InputArgument String before) {
        return listExecutions(ExecutionOwnerScope.forSchedule(decodeId(scheduleId)),
                filter, search, sort, first, after, last, before);
    }

    @DgsQuery
    public ScriptExecutionFilters scriptExecutionFilters(
            @InputArgument @NotBlank String scriptId,
            @InputArgument ScriptExecutionFilterInput filter,
            @InputArgument String search) {
        return facetExecutions(ExecutionOwnerScope.forScript(decodeId(scriptId)), filter, search);
    }

    @DgsQuery
    public ScriptExecutionFilters scheduleExecutionFilters(
            @InputArgument @NotBlank String scheduleId,
            @InputArgument ScriptExecutionFilterInput filter,
            @InputArgument String search) {
        return facetExecutions(ExecutionOwnerScope.forSchedule(decodeId(scheduleId)), filter, search);
    }

    /** Decode Relay-encoded initiator ids, build connection args, delegate to the service. */
    private CountedGenericConnection<GenericEdge<ScriptExecutionResponse>> listExecutions(
            ExecutionOwnerScope owner,
            ScriptExecutionFilterInput filter, String search, SortInput sort,
            Integer first, String after, Integer last, String before) {
        if (filter != null) {
            filter.setInitiatorIds(decodeIds(filter.getInitiatorIds()));
        }
        ConnectionArgs args = ConnectionArgs.builder()
                .first(first).after(after).last(last).before(before)
                .build();
        CursorPaginationCriteria pagination = executionMapper.toCursorPaginationCriteria(args);
        CountedGenericQueryResult<ScriptExecutionResponse> result =
                scriptExecutionService.list(owner, filter, search, sort, pagination);
        return executionMapper.toConnection(result);
    }

    /** Decode + re-encode initiator ids, delegate to the facet service. */
    private ScriptExecutionFilters facetExecutions(ExecutionOwnerScope owner,
                                                   ScriptExecutionFilterInput filter, String search) {
        if (filter != null) {
            filter.setInitiatorIds(decodeIds(filter.getInitiatorIds()));
        }
        ScriptExecutionFilters filters = scriptExecutionFilterService.getExecutionFilters(owner, filter, search);
        // initiators facet values are raw user ids — re-encode to User global ids so the
        // dashboard sends the same global id back in initiatorIds (which is decoded above).
        encodeNodeOptions(filters.getInitiators(), "User");
        return filters;
    }

    private static String decodeId(String id) {
        if (id == null) {
            return null;
        }
        if (RAW_MONGO_OBJECT_ID.matcher(id).matches()) {
            return id;
        }
        return RELAY.fromGlobalId(id).getId();
    }

    private static List<String> decodeIds(List<String> globalIds) {
        return globalIds == null ? null : globalIds.stream().map(ScriptExecutionDataFetcher::decodeId).toList();
    }

    /** Re-encode a facet's raw option values to Relay global ids of the given node type (in place). */
    private static void encodeNodeOptions(List<ScriptFilterOption> options, String nodeType) {
        if (options == null) {
            return;
        }
        options.forEach(o -> o.setValue(RELAY.toGlobalId(nodeType, o.getValue())));
    }

    @DgsData(parentType = "ScriptExecution", field = "initiator")
    public CompletableFuture<UserResponse> initiator(DgsDataFetchingEnvironment dfe) {
        ScriptExecutionResponse execution = dfe.getSource();
        if (execution.getInitiatedBy() == null) {
            return CompletableFuture.completedFuture(null);
        }
        DataLoader<String, UserResponse> loader = dfe.getDataLoader("userDataLoader");
        return loader.load(execution.getInitiatedBy());
    }

    @DgsData(parentType = "ScriptExecution", field = "scriptName")
    public CompletableFuture<String> scriptName(DgsDataFetchingEnvironment dfe) {
        ScriptExecutionResponse execution = dfe.getSource();
        if (execution.getScriptId() == null) {
            return CompletableFuture.completedFuture(null);
        }
        DataLoader<String, ScriptResponse> loader = dfe.getDataLoader("scriptDataLoader");
        return loader.load(execution.getScriptId())
                .thenApply(script -> script == null ? null : script.getName());
    }

    @DgsData(parentType = "ScriptExecution", field = "machine")
    public CompletableFuture<Machine> machine(DgsDataFetchingEnvironment dfe) {
        ScriptExecutionResponse execution = dfe.getSource();
        if (execution.getMachineId() == null) {
            return CompletableFuture.completedFuture(null);
        }
        DataLoader<String, Machine> loader = dfe.getDataLoader("machineDataLoader");
        return loader.load(execution.getMachineId());
    }
}
