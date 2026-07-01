package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsData;
import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.execution.ScriptExecutionFilterInput;
import com.openframe.api.dto.execution.ScriptExecutionFilters;
import com.openframe.api.dto.execution.ScriptExecutionResponse;
import com.openframe.api.dto.script.ScriptFilterOption;
import com.openframe.api.dto.script.ScriptResponse;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.api.mapper.GraphQLScriptExecutionMapper;
import com.openframe.api.service.rmm.ScriptExecutionFilterService;
import com.openframe.api.service.rmm.ScriptExecutionService;
import com.openframe.data.document.device.Machine;
import graphql.relay.Relay;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dataloader.DataLoader;

import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * GraphQL resolver for the Script Execution History tab.
 *
 * <p>Executions are always viewed per saved Script — there is no
 * tenant-wide list. The {@code scriptId} is required; the resolver delegates
 * tenant scoping to {@link ScriptExecutionService}, which uses
 * {@code TenantIdProvider}.
 *
 * <p>{@code Execution.initiator} is resolved via the shared
 * {@code userDataLoader}, batching User lookups across all rows in the page —
 * same pattern as {@code Script.author}. {@code Execution.scriptName} is
 * resolved the same way via {@code scriptDataLoader} from the row's
 * {@code scriptId}, rather than being snapshotted onto the document.
 */
@DgsComponent
@RequiredArgsConstructor
@Slf4j
public class ScriptExecutionDataFetcher {

    private static final Relay RELAY = new Relay();

    private final ScriptExecutionService scriptExecutionService;
    private final ScriptExecutionFilterService scriptExecutionFilterService;
    private final GraphQLScriptExecutionMapper executionMapper;

    /** Relay global id (Base64 "ScriptExecution:&lt;rawId&gt;") for the {@code id} field — the opaque node handle. */
    @DgsData(parentType = "ScriptExecution", field = "id")
    public String scriptExecutionNodeId(DgsDataFetchingEnvironment dfe) {
        ScriptExecutionResponse execution = dfe.getSource();
        return RELAY.toGlobalId("ScriptExecution", execution.getId());
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

        // initiatorIds (User) / machineIds (Machine) arrive as Relay global ids — decode to raw before filtering.
        if (filter != null) {
            filter.setInitiatorIds(decodeIds(filter.getInitiatorIds()));
            filter.setMachineIds(decodeIds(filter.getMachineIds()));
        }
        ConnectionArgs args = ConnectionArgs.builder()
                .first(first).after(after).last(last).before(before)
                .build();
        CursorPaginationCriteria pagination = executionMapper.toCursorPaginationCriteria(args);
        CountedGenericQueryResult<ScriptExecutionResponse> result =
                scriptExecutionService.list(decodeId(scriptId), filter, search, sort, pagination);
        return executionMapper.toConnection(result);
    }

    @DgsQuery
    public ScriptExecutionFilters scriptExecutionFilters(
            @InputArgument @NotBlank String scriptId,
            @InputArgument ScriptExecutionFilterInput filter,
            @InputArgument String search) {
        // initiatorIds (User) / machineIds (Machine) arrive as Relay global ids — decode to raw before filtering.
        if (filter != null) {
            filter.setInitiatorIds(decodeIds(filter.getInitiatorIds()));
            filter.setMachineIds(decodeIds(filter.getMachineIds()));
        }
        ScriptExecutionFilters filters = scriptExecutionFilterService.getExecutionFilters(decodeId(scriptId), filter, search);
        // initiators facet values are raw user ids — re-encode to User global ids so the dashboard
        // sends the same global id back in initiatorIds (which is decoded above).
        encodeNodeOptions(filters.getInitiators(), "User");
        return filters;
    }

    private static String decodeId(String globalId) {
        return globalId == null ? null : RELAY.fromGlobalId(globalId).getId();
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
