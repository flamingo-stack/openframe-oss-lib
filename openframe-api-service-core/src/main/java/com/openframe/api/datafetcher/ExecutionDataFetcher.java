package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsData;
import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.execution.ExecutionResponse;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.api.mapper.GraphQLExecutionMapper;
import com.openframe.api.service.rmm.ExecutionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dataloader.DataLoader;

import java.util.concurrent.CompletableFuture;

/**
 * GraphQL resolver for the Script Execution History tab.
 *
 * <p>Executions are always viewed per saved Script — there is no
 * tenant-wide list. The {@code scriptId} is required; the resolver delegates
 * tenant scoping to {@link ExecutionService}, which uses
 * {@code TenantIdProvider}.
 *
 * <p>{@code Execution.initiator} is resolved via the shared
 * {@code userDataLoader}, batching User lookups across all rows in the page —
 * same pattern as {@code Script.author}.
 */
@DgsComponent
@RequiredArgsConstructor
@Slf4j
public class ExecutionDataFetcher {

    private final ExecutionService executionService;
    private final GraphQLExecutionMapper executionMapper;

    @DgsQuery
    public CountedGenericConnection<GenericEdge<ExecutionResponse>> scriptExecutions(
            @InputArgument @NotBlank String scriptId,
            @InputArgument @Valid SortInput sort,
            @InputArgument Integer first,
            @InputArgument String after,
            @InputArgument Integer last,
            @InputArgument String before) {

        ConnectionArgs args = ConnectionArgs.builder()
                .first(first).after(after).last(last).before(before)
                .build();
        CursorPaginationCriteria pagination = executionMapper.toCursorPaginationCriteria(args);
        CountedGenericQueryResult<ExecutionResponse> result =
                executionService.list(scriptId, sort, pagination);
        return executionMapper.toConnection(result);
    }

    @DgsData(parentType = "Execution", field = "initiator")
    public CompletableFuture<UserResponse> initiator(DgsDataFetchingEnvironment dfe) {
        ExecutionResponse execution = dfe.getSource();
        if (execution.getInitiatedBy() == null) {
            return CompletableFuture.completedFuture(null);
        }
        DataLoader<String, UserResponse> loader = dfe.getDataLoader("userDataLoader");
        return loader.load(execution.getInitiatedBy());
    }
}
