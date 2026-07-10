package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsData;
import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.rmm.schedule.CreateScriptScheduleInput;
import com.openframe.api.dto.rmm.schedule.ScriptScheduleFilterInput;
import com.openframe.api.dto.rmm.schedule.ScriptScheduleFilters;
import com.openframe.api.dto.rmm.schedule.ScriptScheduleResponse;
import com.openframe.api.dto.rmm.schedule.UpdateScriptScheduleInput;
import com.openframe.api.dto.rmm.script.ScriptFilterOption;
import com.openframe.api.dto.rmm.script.ScriptResponse;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.api.mapper.GraphQLScriptScheduleMapper;
import com.openframe.api.service.rmm.ScriptScheduleDeviceService;
import com.openframe.api.service.rmm.ScriptScheduleFilterService;
import com.openframe.api.service.rmm.ScriptScheduleService;
import com.openframe.api.service.rmm.ScriptService;
import com.openframe.data.document.device.Machine;
import com.openframe.security.authentication.AuthPrincipal;
import graphql.relay.Relay;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dataloader.DataLoader;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * GraphQL resolver for RMM script-schedule CRUD. Pure passthrough to
 * {@link ScriptScheduleService} — tenant scoping is resolved inside the service
 * via {@code TenantIdProvider}. Mirrors {@code ScriptDataFetcher} (minus
 * run/dispatch/tags).
 */
@DgsComponent
@RequiredArgsConstructor
@Slf4j
@Validated
public class ScriptScheduleDataFetcher {

    private static final Relay RELAY = new Relay();

    private final ScriptScheduleService scheduleService;
    private final ScriptScheduleFilterService scheduleFilterService;
    private final ScriptService scriptService;
    private final ScriptScheduleDeviceService scheduleDeviceService;
    private final GraphQLScriptScheduleMapper scheduleMapper;

    @DgsQuery
    public ScriptScheduleResponse scriptSchedule(@InputArgument @NotBlank String id) {
        return scheduleService.get(decodeId(id));
    }

    @DgsQuery
    public CountedGenericConnection<GenericEdge<ScriptScheduleResponse>> scriptSchedules(
            @InputArgument @Valid ScriptScheduleFilterInput filter,
            @InputArgument String search,
            @InputArgument @Valid SortInput sort,
            @InputArgument Integer first,
            @InputArgument String after,
            @InputArgument Integer last,
            @InputArgument String before) {

        if (filter != null) {
            filter.setAuthorIds(decodeIds(filter.getAuthorIds()));
        }
        ConnectionArgs args = ConnectionArgs.builder()
                .first(first).after(after).last(last).before(before)
                .build();
        CursorPaginationCriteria pagination = scheduleMapper.toCursorPaginationCriteria(args);
        CountedGenericQueryResult<ScriptScheduleResponse> result =
                scheduleService.list(filter, search, sort, pagination);
        return scheduleMapper.toConnection(result);
    }

    @DgsQuery
    public ScriptScheduleFilters scriptScheduleFilters(@InputArgument @Valid ScriptScheduleFilterInput filter) {
        if (filter != null) {
            filter.setAuthorIds(decodeIds(filter.getAuthorIds()));
        }
        ScriptScheduleFilters filters = scheduleFilterService.getScriptScheduleFilters(filter);
        // authors facet values are raw user ids — re-encode to User global ids so the dashboard
        // sends the same global id back in authorIds (which is decoded above).
        encodeNodeOptions(filters.getAuthors(), "User");
        return filters;
    }

    @DgsMutation
    public ScriptScheduleResponse createScriptSchedule(@InputArgument @Valid CreateScriptScheduleInput input,
                                                       @AuthenticationPrincipal AuthPrincipal principal) {
        input.setScriptIds(decodeIds(input.getScriptIds()));
        return scheduleService.create(input, principal.getId());
    }

    @DgsMutation
    public ScriptScheduleResponse updateScriptSchedule(@InputArgument @Valid UpdateScriptScheduleInput input) {
        input.setId(decodeId(input.getId()));
        input.setScriptIds(decodeIds(input.getScriptIds()));
        return scheduleService.update(input);
    }

    @DgsMutation
    public String deleteScriptSchedule(@InputArgument @NotBlank String id) {
        return scheduleService.delete(decodeId(id));
    }

    @DgsMutation
    public ScriptScheduleResponse archiveScriptSchedule(@InputArgument @NotBlank String id) {
        return scheduleService.archive(decodeId(id));
    }

    @DgsMutation
    public ScriptScheduleResponse unarchiveScriptSchedule(@InputArgument @NotBlank String id) {
        return scheduleService.unarchive(decodeId(id));
    }

    /**
     * Replace the devices assigned to a schedule.
     */
    @DgsMutation
    public ScriptScheduleResponse setScriptScheduleDevices(@InputArgument @NotBlank String scheduleId,
                                                           @InputArgument List<String> machineIds,
                                                           @AuthenticationPrincipal AuthPrincipal principal) {
        String rawScheduleId = decodeId(scheduleId);
        scheduleDeviceService.setDevices(rawScheduleId, decodeIds(machineIds), principal.getId());
        return scheduleService.get(rawScheduleId);
    }

    /** Returns the Relay global id ("ScriptSchedule:&lt;rawId&gt;") for the {@code id} field. */
    @DgsData(parentType = "ScriptSchedule", field = "id")
    public String scriptScheduleNodeId(DgsDataFetchingEnvironment dfe) {
        ScriptScheduleResponse schedule = dfe.getSource();
        return RELAY.toGlobalId("ScriptSchedule", schedule.getId());
    }

    /**
     * Resolves {@code ScriptSchedule.scripts} from the stored script ids.
     */
    @DgsData(parentType = "ScriptSchedule", field = "scripts")
    public List<ScriptResponse> scripts(DgsDataFetchingEnvironment dfe) {
        ScriptScheduleResponse schedule = dfe.getSource();
        List<String> ids = schedule.getScriptIds();
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        Map<String, ScriptResponse> byId = scriptService.getScriptsByIds(ids).stream()
                .collect(Collectors.toMap(ScriptResponse::getId, Function.identity(), (a, b) -> a));
        return ids.stream().map(byId::get).filter(Objects::nonNull).toList();
    }

    /**
     * Resolves {@code ScriptSchedule.assignedDevices}: schedule id → assigned machineIds
     * (batched via {@code scriptScheduleDeviceIdsDataLoader}) → Machine objects (batched via
     * {@code machineDataLoader}). Machines that no longer resolve are dropped.
     */
    @DgsData(parentType = "ScriptSchedule", field = "assignedDevices")
    public CompletableFuture<List<Machine>> assignedDevices(DgsDataFetchingEnvironment dfe) {
        ScriptScheduleResponse schedule = dfe.getSource();
        DataLoader<String, List<String>> idsLoader = dfe.getDataLoader("scriptScheduleDeviceIdsDataLoader");
        DataLoader<String, Machine> machineLoader = dfe.getDataLoader("machineDataLoader");
        return idsLoader.load(schedule.getId()).thenCompose(machineIds ->
                machineLoader.loadMany(machineIds)
                        .thenApply(machines -> machines.stream().filter(Objects::nonNull).toList()));
    }

    /** Resolves {@code ScriptSchedule.deviceCount} (the DEVICES column), batched per request. */
    @DgsData(parentType = "ScriptSchedule", field = "deviceCount")
    public CompletableFuture<Integer> deviceCount(DgsDataFetchingEnvironment dfe) {
        ScriptScheduleResponse schedule = dfe.getSource();
        DataLoader<String, List<String>> idsLoader = dfe.getDataLoader("scriptScheduleDeviceIdsDataLoader");
        return idsLoader.load(schedule.getId()).thenApply(List::size);
    }

    /** Resolves {@code ScriptSchedule.author} from {@code createdBy}, batched via the user loader. */
    @DgsData(parentType = "ScriptSchedule", field = "author")
    public CompletableFuture<UserResponse> author(DgsDataFetchingEnvironment dfe) {
        ScriptScheduleResponse schedule = dfe.getSource();
        if (schedule.getCreatedBy() == null) {
            return CompletableFuture.completedFuture(null);
        }
        DataLoader<String, UserResponse> loader = dfe.getDataLoader("userDataLoader");
        return loader.load(schedule.getCreatedBy());
    }

    private static String decodeId(String globalId) {
        return globalId == null ? null : RELAY.fromGlobalId(globalId).getId();
    }

    private static List<String> decodeIds(List<String> globalIds) {
        return globalIds == null ? null : globalIds.stream().map(ScriptScheduleDataFetcher::decodeId).toList();
    }

    private static void encodeNodeOptions(List<ScriptFilterOption> options, String nodeType) {
        if (options == null) {
            return;
        }
        options.forEach(o -> o.setValue(RELAY.toGlobalId(nodeType, o.getValue())));
    }
}
