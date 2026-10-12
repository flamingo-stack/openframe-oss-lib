package com.openframe.api.datafetcher.rmm;

import com.netflix.graphql.dgs.DgsComponent;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
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
import com.openframe.api.dto.rmm.schedule.ScheduleDeviceCriteriaInput;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.api.mapper.GraphQLDeviceMapper;
import com.openframe.graphql.relay.RelayIdCodec;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.rmm.software.SoftwareScheduleService;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.schedule.ScheduleDeviceCriteria;
import com.openframe.data.service.rmm.software.PackageManagerAvailability;
import com.openframe.security.authentication.AuthPrincipal;
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

import static com.openframe.graphql.relay.NodeType.MACHINE;
import static com.openframe.graphql.relay.NodeType.SOFTWARE_SCHEDULE;

@DgsComponent
@RequiredArgsConstructor
@Slf4j
@Validated
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
public class SoftwareScheduleDataFetcher {

    private final SoftwareScheduleService scheduleService;
    private final DeviceService deviceService;
    private final GraphQLDeviceMapper deviceMapper;
    private final PackageManagerAvailability packageManagerAvailability;
    private final RelayIdCodec relayIdCodec;

    @DgsQuery
    public SoftwareScheduleResponse softwareSchedule(@InputArgument @NotBlank String id) {
        String scheduleId = relayIdCodec.decode(id, SOFTWARE_SCHEDULE);
        return scheduleService.get(scheduleId);
    }

    @DgsQuery
    public List<SoftwareScheduleResponse> softwareSchedules() {
        return scheduleService.list();
    }

    @DgsMutation
    public SoftwareScheduleResponse createSoftwareSchedule(@InputArgument @Valid CreateSoftwareScheduleInput input,
                                                           @AuthenticationPrincipal AuthPrincipal principal) {
        List<String> machineGlobalIds = input.getMachineIds();
        List<String> machineIds = relayIdCodec.decodeAll(machineGlobalIds, MACHINE);
        input.setMachineIds(machineIds);
        String userId = principal.getId();
        return scheduleService.create(input, userId);
    }

    @DgsMutation
    public SoftwareScheduleResponse updateSoftwareSchedule(@InputArgument @Valid UpdateSoftwareScheduleInput input,
                                                           @AuthenticationPrincipal AuthPrincipal principal) {
        String scheduleGlobalId = input.getId();
        List<String> machineGlobalIds = input.getMachineIds();
        String scheduleId = relayIdCodec.decode(scheduleGlobalId, SOFTWARE_SCHEDULE);
        List<String> machineIds = relayIdCodec.decodeAll(machineGlobalIds, MACHINE);
        input.setId(scheduleId);
        input.setMachineIds(machineIds);
        String userId = principal.getId();
        return scheduleService.update(input, userId);
    }

    @DgsMutation
    public String deleteSoftwareSchedule(@InputArgument @NotBlank String id) {
        String scheduleId = relayIdCodec.decode(id, SOFTWARE_SCHEDULE);
        return scheduleService.delete(scheduleId);
    }

    @DgsMutation
    public SoftwareScheduleResponse archiveSoftwareSchedule(@InputArgument @NotBlank String id) {
        String scheduleId = relayIdCodec.decode(id, SOFTWARE_SCHEDULE);
        return scheduleService.archive(scheduleId);
    }

    @DgsMutation
    public SoftwareScheduleResponse unarchiveSoftwareSchedule(@InputArgument @NotBlank String id) {
        String scheduleId = relayIdCodec.decode(id, SOFTWARE_SCHEDULE);
        return scheduleService.unarchive(scheduleId);
    }

    @DgsMutation
    public SoftwareScheduleResponse setSoftwareScheduleDevices(@InputArgument @NotBlank String scheduleId,
                                                              @InputArgument List<String> machineIds,
                                                              @AuthenticationPrincipal AuthPrincipal principal) {
        String rawScheduleId = relayIdCodec.decode(scheduleId, SOFTWARE_SCHEDULE);
        List<String> rawMachineIds = relayIdCodec.decodeAll(machineIds, MACHINE);
        String userId = principal.getId();
        return scheduleService.setDevices(rawScheduleId, rawMachineIds, userId);
    }

    @DgsMutation
    public SoftwareScheduleResponse addDevicesToSoftwareSchedule(@InputArgument @NotBlank String scheduleId,
                                                                @InputArgument List<String> machineIds,
                                                                @AuthenticationPrincipal AuthPrincipal principal) {
        String rawScheduleId = relayIdCodec.decode(scheduleId, SOFTWARE_SCHEDULE);
        List<String> rawMachineIds = relayIdCodec.decodeAll(machineIds, MACHINE);
        String userId = principal.getId();
        scheduleService.addDevices(rawScheduleId, rawMachineIds, userId);
        return scheduleService.get(rawScheduleId);
    }

    @DgsMutation
    public SoftwareScheduleResponse removeDevicesFromSoftwareSchedule(@InputArgument @NotBlank String scheduleId,
                                                                     @InputArgument List<String> machineIds,
                                                                     @AuthenticationPrincipal AuthPrincipal principal) {
        String rawScheduleId = relayIdCodec.decode(scheduleId, SOFTWARE_SCHEDULE);
        List<String> rawMachineIds = relayIdCodec.decodeAll(machineIds, MACHINE);
        String userId = principal.getId();
        scheduleService.removeDevices(rawScheduleId, rawMachineIds, userId);
        return scheduleService.get(rawScheduleId);
    }

    @DgsMutation
    public SoftwareScheduleResponse setSoftwareScheduleDeviceCriteria(@InputArgument @NotBlank String scheduleId,
                                                                     @InputArgument @Valid ScheduleDeviceCriteriaInput criteria,
                                                                     @AuthenticationPrincipal AuthPrincipal principal) {
        ScheduleDeviceCriteria domainCriteria = ScheduleDeviceCriteria.builder()
                .organizationIds(criteria.getOrganizationIds())
                .deviceTypes(criteria.getDeviceTypes())
                .osTypes(criteria.getOsTypes())
                .build();
        String rawScheduleId = relayIdCodec.decode(scheduleId, SOFTWARE_SCHEDULE);
        String userId = principal.getId();
        return scheduleService.setDeviceCriteria(rawScheduleId, domainCriteria, userId);
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
        List<PackageManagerType> enabledManagers = packageManagerAvailability.enabledManagers();
        DeviceFilterCriteria filterOptions = deviceMapper.toDeviceFilterCriteria(filter, enabledManagers);
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
        List<PackageManagerType> enabledManagers = packageManagerAvailability.enabledManagers();
        DeviceFilterCriteria filterOptions = deviceMapper.toDeviceFilterCriteria(filter, enabledManagers);
        return deviceService.getAvailableDeviceFilters(null, filterOptions, search);
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
}
