package com.openframe.api.datafetcher.rmm;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsData;
import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.AvailableDeviceEdge;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.device.DeviceFilterCriteria;
import com.openframe.api.dto.device.DeviceFilterInput;
import com.openframe.api.dto.device.DeviceFilters;
import com.openframe.api.dto.rmm.software.CreateSoftwareScheduleInput;
import com.openframe.api.dto.rmm.software.SoftwareScheduleResponse;
import com.openframe.api.dto.rmm.software.UpdateSoftwareScheduleInput;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.api.mapper.GraphQLDeviceMapper;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.rmm.software.SoftwareScheduleService;
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

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;

@DgsComponent
@RequiredArgsConstructor
@Slf4j
@Validated
public class SoftwareScheduleDataFetcher {

    private static final Relay RELAY = new Relay();

    private final SoftwareScheduleService scheduleService;
    private final DeviceService deviceService;
    private final GraphQLDeviceMapper deviceMapper;

    @DgsQuery
    public SoftwareScheduleResponse softwareSchedule(@InputArgument @NotBlank String id) {
        return scheduleService.get(decodeId(id));
    }

    @DgsQuery
    public List<SoftwareScheduleResponse> softwareSchedules() {
        return scheduleService.list();
    }

    @DgsMutation
    public SoftwareScheduleResponse createSoftwareSchedule(@InputArgument @Valid CreateSoftwareScheduleInput input,
                                                           @AuthenticationPrincipal AuthPrincipal principal) {
        input.setMachineIds(decodeIds(input.getMachineIds()));
        return scheduleService.create(input, principal.getId());
    }

    @DgsMutation
    public SoftwareScheduleResponse updateSoftwareSchedule(@InputArgument @Valid UpdateSoftwareScheduleInput input,
                                                           @AuthenticationPrincipal AuthPrincipal principal) {
        input.setId(decodeId(input.getId()));
        input.setMachineIds(decodeIds(input.getMachineIds()));
        return scheduleService.update(input, principal.getId());
    }

    @DgsMutation
    public String deleteSoftwareSchedule(@InputArgument @NotBlank String id) {
        return scheduleService.delete(decodeId(id));
    }

    @DgsMutation
    public SoftwareScheduleResponse archiveSoftwareSchedule(@InputArgument @NotBlank String id) {
        return scheduleService.archive(decodeId(id));
    }

    @DgsMutation
    public SoftwareScheduleResponse unarchiveSoftwareSchedule(@InputArgument @NotBlank String id) {
        return scheduleService.unarchive(decodeId(id));
    }

    @DgsMutation
    public SoftwareScheduleResponse setSoftwareScheduleDevices(@InputArgument @NotBlank String scheduleId,
                                                              @InputArgument List<String> machineIds,
                                                              @AuthenticationPrincipal AuthPrincipal principal) {
        return scheduleService.setDevices(decodeId(scheduleId), decodeIds(machineIds), principal.getId());
    }

    @DgsMutation
    public SoftwareScheduleResponse addDevicesToSoftwareSchedule(@InputArgument @NotBlank String scheduleId,
                                                                @InputArgument List<String> machineIds,
                                                                @AuthenticationPrincipal AuthPrincipal principal) {
        String rawScheduleId = decodeId(scheduleId);
        scheduleService.addDevices(rawScheduleId, decodeIds(machineIds), principal.getId());
        return scheduleService.get(rawScheduleId);
    }

    @DgsMutation
    public SoftwareScheduleResponse removeDevicesFromSoftwareSchedule(@InputArgument @NotBlank String scheduleId,
                                                                     @InputArgument List<String> machineIds,
                                                                     @AuthenticationPrincipal AuthPrincipal principal) {
        String rawScheduleId = decodeId(scheduleId);
        scheduleService.removeDevices(rawScheduleId, decodeIds(machineIds), principal.getId());
        return scheduleService.get(rawScheduleId);
    }

    @DgsData(parentType = "SoftwareSchedule", field = "id")
    public String softwareScheduleNodeId(DgsDataFetchingEnvironment dfe) {
        SoftwareScheduleResponse schedule = dfe.getSource();
        return RELAY.toGlobalId("SoftwareSchedule", schedule.getId());
    }

    @DgsData(parentType = "SoftwareSchedule", field = "assignedDevices")
    public CountedGenericConnection<GenericEdge<Machine>> assignedDevices(
            DgsDataFetchingEnvironment dfe,
            @InputArgument @Valid DeviceFilterInput filter,
            @InputArgument Integer first,
            @InputArgument String after,
            @InputArgument Integer last,
            @InputArgument String before,
            @InputArgument String search,
            @InputArgument @Valid SortInput sort) {
        SoftwareScheduleResponse schedule = dfe.getSource();
        List<String> machineIds = scheduleService.getMachineIds(schedule.getId());
        DeviceFilterCriteria filterOptions = deviceMapper.toDeviceFilterCriteria(filter);
        ConnectionArgs args = ConnectionArgs.builder().first(first).after(after).last(last).before(before).build();
        CursorPaginationCriteria pagination = deviceMapper.toCursorPaginationCriteria(args);
        CountedGenericQueryResult<Machine> result =
                deviceService.queryAssignedDevices(machineIds, filterOptions, pagination, search, sort);
        return deviceMapper.toDeviceConnection(result);
    }

    @DgsData(parentType = "SoftwareSchedule", field = "availableDevices")
    public CountedGenericConnection<AvailableDeviceEdge> availableDevices(
            DgsDataFetchingEnvironment dfe,
            @InputArgument @Valid DeviceFilterInput filter,
            @InputArgument Integer first,
            @InputArgument String after,
            @InputArgument Integer last,
            @InputArgument String before,
            @InputArgument String search,
            @InputArgument @Valid SortInput sort) {
        SoftwareScheduleResponse schedule = dfe.getSource();
        DeviceFilterCriteria filterOptions = deviceMapper.toDeviceFilterCriteria(filter);
        ConnectionArgs args = ConnectionArgs.builder().first(first).after(after).last(last).before(before).build();
        CursorPaginationCriteria pagination = deviceMapper.toCursorPaginationCriteria(args);
        Set<String> assigned = new HashSet<>(scheduleService.getMachineIds(schedule.getId()));
        // Software schedules have no platform constraint (packages carry their own manager) → null platforms = all devices.
        CountedGenericQueryResult<Machine> result = deviceService.queryAvailableDevicesForSchedule(
                null, assigned, filterOptions, pagination, search);
        return deviceMapper.toAvailableDeviceConnection(result, assigned);
    }

    @DgsData(parentType = "SoftwareSchedule", field = "assignedDeviceFilters")
    public DeviceFilters assignedDeviceFilters(DgsDataFetchingEnvironment dfe,
                                               @InputArgument @Valid DeviceFilterInput filter,
                                               @InputArgument String search) {
        SoftwareScheduleResponse schedule = dfe.getSource();
        List<String> machineIds = scheduleService.getMachineIds(schedule.getId());
        return deviceService.getAssignedDeviceFilters(machineIds, deviceMapper.toDeviceFilterCriteria(filter), search);
    }

    @DgsData(parentType = "SoftwareSchedule", field = "availableDeviceFilters")
    public DeviceFilters availableDeviceFilters(DgsDataFetchingEnvironment dfe,
                                                @InputArgument @Valid DeviceFilterInput filter,
                                                @InputArgument String search) {
        return deviceService.getAvailableDeviceFilters(null, deviceMapper.toDeviceFilterCriteria(filter), search);
    }

    @DgsData(parentType = "SoftwareSchedule", field = "deviceCount")
    public Integer deviceCount(DgsDataFetchingEnvironment dfe) {
        SoftwareScheduleResponse schedule = dfe.getSource();
        return scheduleService.deviceCount(schedule.getId());
    }

    @DgsData(parentType = "SoftwareSchedule", field = "author")
    public CompletableFuture<UserResponse> author(DgsDataFetchingEnvironment dfe) {
        SoftwareScheduleResponse schedule = dfe.getSource();
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
        return globalIds == null ? null : globalIds.stream().map(SoftwareScheduleDataFetcher::decodeId).toList();
    }
}
