package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsData;
import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.rmm.schedulerun.ScheduleRunFilterInput;
import com.openframe.api.dto.rmm.schedulerun.ScheduleRunResponse;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.api.mapper.GraphQLScheduleRunMapper;
import com.openframe.api.service.rmm.ScheduleRunService;
import graphql.relay.Relay;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dataloader.DataLoader;

import java.util.concurrent.CompletableFuture;

/**
 * GraphQL resolver for the "Schedule Runs" tab. Fires are always viewed per saved schedule —
 * {@code scheduleId} is required; the resolver delegates tenant scoping to
 * {@link ScheduleRunService}. {@code initiator} is resolved via the shared {@code userDataLoader}
 * so a page-load batches User lookups across every row.
 */
@DgsComponent
@RequiredArgsConstructor
@Slf4j
public class ScheduleRunDataFetcher {

    private static final Relay RELAY = new Relay();

    private final ScheduleRunService scheduleRunService;
    private final GraphQLScheduleRunMapper mapper;

    /** Relay global id ("ScheduleRun:&lt;rawId&gt;") for the {@code id} field. */
    @DgsData(parentType = "ScheduleRun", field = "id")
    public String scheduleRunNodeId(DgsDataFetchingEnvironment dfe) {
        ScheduleRunResponse run = dfe.getSource();
        return RELAY.toGlobalId("ScheduleRun", run.getId());
    }

    @DgsQuery
    public CountedGenericConnection<GenericEdge<ScheduleRunResponse>> scheduleRuns(
            @InputArgument @NotBlank String scheduleId,
            @InputArgument @Valid ScheduleRunFilterInput filter,
            @InputArgument String search,
            @InputArgument Integer first,
            @InputArgument String after,
            @InputArgument Integer last,
            @InputArgument String before) {

        ConnectionArgs args = ConnectionArgs.builder()
                .first(first).after(after).last(last).before(before)
                .build();
        CursorPaginationCriteria pagination = mapper.toCursorPaginationCriteria(args);
        CountedGenericQueryResult<ScheduleRunResponse> result = scheduleRunService.list(decodeId(scheduleId), filter, search, pagination);
        return mapper.toConnection(result);
    }

    @DgsData(parentType = "ScheduleRun", field = "initiator")
    public CompletableFuture<UserResponse> initiator(DgsDataFetchingEnvironment dfe) {
        ScheduleRunResponse run = dfe.getSource();
        if (run.getInitiatedBy() == null) {
            return CompletableFuture.completedFuture(null);
        }
        DataLoader<String, UserResponse> loader = dfe.getDataLoader("userDataLoader");
        return loader.load(run.getInitiatedBy());
    }

    private static String decodeId(String globalId) {
        return globalId == null ? null : RELAY.fromGlobalId(globalId).getId();
    }
}
