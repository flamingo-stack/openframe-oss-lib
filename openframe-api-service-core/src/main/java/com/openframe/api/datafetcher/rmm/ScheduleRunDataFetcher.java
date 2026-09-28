package com.openframe.api.datafetcher.rmm;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsData;
import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.rmm.schedulerun.ScheduleRunFilterInput;
import com.openframe.api.dto.rmm.schedulerun.ScheduleRunFilters;
import com.openframe.api.dto.rmm.schedulerun.ScheduleRunResponse;
import com.openframe.api.dto.rmm.script.ScriptFilterOption;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.api.mapper.GraphQLScheduleRunMapper;
import com.openframe.api.service.rmm.schedule.ScheduleRunFilterService;
import com.openframe.api.service.rmm.schedule.ScheduleRunService;

import graphql.relay.Relay;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dataloader.DataLoader;

import java.util.List;
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
    private final ScheduleRunFilterService scheduleRunFilterService;
    private final GraphQLScheduleRunMapper mapper;

    /** Relay global id ("ScheduleRun:&lt;rawId&gt;") for the {@code id} field. */
    @DgsData(parentType = "ScheduleRun", field = "id")
    public String scheduleRunNodeId(DgsDataFetchingEnvironment dfe) {
        ScheduleRunResponse run = dfe.getSource();
        return RELAY.toGlobalId("ScheduleRun", run.getId());
    }

    @DgsQuery
    public ScheduleRunResponse scheduleRun(@InputArgument @NotBlank String id) {
        return scheduleRunService.get(decodeId(id));
    }

    @DgsQuery
    public CountedGenericConnection<GenericEdge<ScheduleRunResponse>> scheduleRuns(
            @InputArgument @NotBlank String scheduleId,
            @InputArgument @Valid ScheduleRunFilterInput filter,
            @InputArgument String search,
            @InputArgument @Valid SortInput sort,
            @InputArgument Integer first,
            @InputArgument String after,
            @InputArgument Integer last,
            @InputArgument String before) {

        ConnectionArgs args = ConnectionArgs.builder()
                .first(first).after(after).last(last).before(before)
                .build();
        CursorPaginationCriteria pagination = mapper.toCursorPaginationCriteria(args);
        CountedGenericQueryResult<ScheduleRunResponse> result = scheduleRunService.list(decodeId(scheduleId), filter, search, sort, pagination);
        return mapper.toConnection(result);
    }

    @DgsQuery
    public ScheduleRunFilters scheduleRunFilters(
            @InputArgument @NotBlank String scheduleId,
            @InputArgument @Valid ScheduleRunFilterInput filter,
            @InputArgument String search) {
        ScheduleRunFilters filters =
                scheduleRunFilterService.getScheduleRunFilters(decodeId(scheduleId), filter, search);
        encodeNodeOptions(filters.getInitiators(), "User");
        return filters;
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

    /** Re-encode a facet's raw option values to Relay global ids of the given node type (in place). */
    private static void encodeNodeOptions(List<ScriptFilterOption> options, String nodeType) {
        if (options == null) {
            return;
        }
        options.forEach(o -> o.setValue(RELAY.toGlobalId(nodeType, o.getValue())));
    }
}
