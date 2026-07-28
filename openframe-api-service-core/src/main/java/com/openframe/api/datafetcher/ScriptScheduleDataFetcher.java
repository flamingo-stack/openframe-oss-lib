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
import com.openframe.api.dto.device.DeviceFilterCriteria;
import com.openframe.api.dto.device.DeviceFilterInput;
import com.openframe.api.dto.rmm.DispatchResponse;
import com.openframe.api.dto.rmm.schedule.CreateScriptScheduleInput;
import com.openframe.api.dto.rmm.schedule.ScheduleDeviceCriteriaInput;
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
import com.openframe.api.mapper.GraphQLDeviceMapper;
import com.openframe.api.mapper.GraphQLScriptScheduleMapper;
import com.openframe.api.service.DeviceService;
import com.openframe.api.service.rmm.ScriptDispatchService;
import com.openframe.api.service.rmm.ScriptScheduleDeviceService;
import com.openframe.api.service.rmm.ScriptScheduleFilterService;
import com.openframe.api.service.rmm.ScriptScheduleService;
import com.openframe.api.service.rmm.ScriptService;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.ScheduleDeviceCriteria;
import com.openframe.security.authentication.AuthPrincipal;
import graphql.relay.Relay;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dataloader.DataLoader;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
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
    private final ScriptDispatchService scriptDispatchService;
    private final GraphQLScriptScheduleMapper scheduleMapper;
    private final DeviceService deviceService;
    private final GraphQLDeviceMapper deviceMapper;

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

    /**
     * Devices selectable for a schedule — the "Available Devices" picker. Scoped to the schedule's
     * supportedPlatforms so platform-mismatched devices are never even shown (a Windows device is
     * not offered for a macOS schedule). {@code ScriptScheduleDeviceService.setDevices} still
     * rejects a mismatch defensively, but this keeps them out of the UI entirely.
     */
    @DgsQuery
    public CountedGenericConnection<GenericEdge<Machine>> availableDevicesForSchedule(
            @InputArgument @NotBlank String scheduleId,
            @InputArgument @Valid DeviceFilterInput filter,
            @InputArgument Integer first,
            @InputArgument String after,
            @InputArgument Integer last,
            @InputArgument String before,
            @InputArgument String search,
            @InputArgument @Valid SortInput sort) {
        ScriptScheduleResponse schedule = scheduleService.get(decodeId(scheduleId));
        DeviceFilterCriteria filterOptions = deviceMapper.toDeviceFilterCriteria(filter);
        ConnectionArgs connectionArgs = ConnectionArgs.builder().first(first).after(after).last(last).before(before).build();
        CursorPaginationCriteria pagination = deviceMapper.toCursorPaginationCriteria(connectionArgs);
        CountedGenericQueryResult<Machine> result = deviceService.queryDevicesForPlatforms(
                schedule.getSupportedPlatforms(), filterOptions, pagination, search, sort);
        return deviceMapper.toDeviceConnection(result);
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

    /** Incrementally assign the given devices (the "+"/"Add selected" actions). Idempotent. */
    @DgsMutation
    public ScriptScheduleResponse addDevicesToSchedule(@InputArgument @NotBlank String scheduleId,
                                                       @InputArgument List<String> machineIds,
                                                       @AuthenticationPrincipal AuthPrincipal principal) {
        String rawScheduleId = decodeId(scheduleId);
        scheduleDeviceService.addDevices(rawScheduleId, decodeIds(machineIds), principal.getId());
        return scheduleService.get(rawScheduleId);
    }

    /** Incrementally unassign the given devices (the trash / "Remove selected" actions). */
    @DgsMutation
    public ScriptScheduleResponse removeDevicesFromSchedule(@InputArgument @NotBlank String scheduleId,
                                                            @InputArgument List<String> machineIds,
                                                            @AuthenticationPrincipal AuthPrincipal principal) {
        String rawScheduleId = decodeId(scheduleId);
        scheduleDeviceService.removeDevices(rawScheduleId, decodeIds(machineIds), principal.getId());
        return scheduleService.get(rawScheduleId);
    }

    /** Assign ALL devices matching the current Available-Devices filter/search (the "Add N Devices" action). */
    @DgsMutation
    public ScriptScheduleResponse addAllDevicesToSchedule(@InputArgument @NotBlank String scheduleId,
                                                          @InputArgument @Valid DeviceFilterInput filter,
                                                          @InputArgument String search,
                                                          @AuthenticationPrincipal AuthPrincipal principal) {
        String rawScheduleId = decodeId(scheduleId);
        ScriptScheduleResponse schedule = scheduleService.get(rawScheduleId);
        DeviceFilterCriteria filterOptions = deviceMapper.toDeviceFilterCriteria(filter);
        List<String> ids = deviceService.findDeviceIdsForPlatforms(
                schedule.getSupportedPlatforms(), filterOptions, search);
        scheduleDeviceService.addDevices(rawScheduleId, ids, principal.getId());
        return scheduleService.get(rawScheduleId);
    }

    /**
     * Unassign ALL currently-assigned devices matching the Selected-Devices filter/search (the
     * "Remove N Devices" action). With no filter this clears the whole assignment.
     */
    @DgsMutation
    public ScriptScheduleResponse removeAllDevicesFromSchedule(@InputArgument @NotBlank String scheduleId,
                                                               @InputArgument @Valid DeviceFilterInput filter,
                                                               @InputArgument String search,
                                                               @AuthenticationPrincipal AuthPrincipal principal) {
        String rawScheduleId = decodeId(scheduleId);
        List<String> assigned = scheduleDeviceService.getMachineIds(rawScheduleId);
        DeviceFilterCriteria filterOptions = deviceMapper.toDeviceFilterCriteria(filter);
        List<String> ids = deviceService.findAssignedDeviceIds(assigned, filterOptions, search);
        scheduleDeviceService.removeDevices(rawScheduleId, ids, principal.getId());
        return scheduleService.get(rawScheduleId);
    }

    /**
     * Switch a schedule to CRITERIA device selection and store its rule (the "Select Devices by
     * Criteria" → Save Devices action). Targets are then resolved live, so devices registered later
     * that match the rule are picked up automatically.
     */
    @DgsMutation
    public ScriptScheduleResponse setScheduleDeviceCriteria(@InputArgument @NotBlank String scheduleId,
                                                            @InputArgument @Valid ScheduleDeviceCriteriaInput criteria,
                                                            @AuthenticationPrincipal AuthPrincipal principal) {
        String rawScheduleId = decodeId(scheduleId);
        ScheduleDeviceCriteria domainCriteria = ScheduleDeviceCriteria.builder()
                .organizationIds(criteria.getOrganizationIds())
                .deviceTypes(criteria.getDeviceTypes())
                .osTypes(criteria.getOsTypes())
                .build();
        scheduleDeviceService.applyCriteria(rawScheduleId, domainCriteria, principal.getId());
        return scheduleService.get(rawScheduleId);
    }

    /**
     * Ad-hoc "run now" of a schedule.
     */
    @DgsMutation
    public DispatchResponse runScheduleJobNow(@InputArgument @NotBlank String scheduleId) {
        return scriptDispatchService.runSchedule(decodeId(scheduleId), getCurrentUserId());
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
     * Resolves {@code ScriptSchedule.assignedDevices} as a Relay connection — same
     * filter/search/sort/pagination machinery as the top-level {@code devices} query, scoped to
     * the machineIds assigned to this schedule. Resolved synchronously (no chained DataLoaders,
     * which is what previously deadlocked and 504'd this field); {@code Machine.organization} and
     * the like still batch per request at the next level.
     */
    @DgsData(parentType = "ScriptSchedule", field = "assignedDevices")
    public CountedGenericConnection<GenericEdge<Machine>> assignedDevices(
            DgsDataFetchingEnvironment dfe,
            @InputArgument @Valid DeviceFilterInput filter,
            @InputArgument Integer first,
            @InputArgument String after,
            @InputArgument Integer last,
            @InputArgument String before,
            @InputArgument String search,
            @InputArgument @Valid SortInput sort) {
        ScriptScheduleResponse schedule = dfe.getSource();
        List<String> machineIds = scheduleDeviceService.getMachineIds(schedule.getId());

        DeviceFilterCriteria filterOptions = deviceMapper.toDeviceFilterCriteria(filter);
        ConnectionArgs connectionArgs = ConnectionArgs.builder().first(first).after(after).last(last).before(before).build();
        CursorPaginationCriteria pagination = deviceMapper.toCursorPaginationCriteria(connectionArgs);
        CountedGenericQueryResult<Machine> result =
                deviceService.queryAssignedDevices(machineIds, filterOptions, pagination, search, sort);
        return deviceMapper.toDeviceConnection(result);
    }

    /** Resolves {@code ScriptSchedule.deviceCount} (the DEVICES column), batched per request. */
    @DgsData(parentType = "ScriptSchedule", field = "deviceCount")
    public CompletableFuture<Integer> deviceCount(DgsDataFetchingEnvironment dfe) {
        ScriptScheduleResponse schedule = Objects.requireNonNull(dfe.getSource(), "deviceCount: null source schedule");
        DataLoader<String, Integer> countLoader = Objects.requireNonNull(
                dfe.getDataLoader("scriptScheduleDeviceCountDataLoader"),
                "scriptScheduleDeviceCountDataLoader is not registered");
        return countLoader.load(schedule.getId());
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

    private String getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return AuthPrincipal.fromJwt((Jwt) auth.getPrincipal()).getId();
    }
}
