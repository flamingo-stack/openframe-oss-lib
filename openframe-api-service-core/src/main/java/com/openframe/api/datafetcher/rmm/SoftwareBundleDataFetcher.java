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
import com.openframe.api.dto.rmm.software.SoftwareBundleResponse;
import com.openframe.api.dto.rmm.software.SubmitSoftwareBundleInput;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.mapper.GraphQLDeviceMapper;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.rmm.software.SoftwareBundleService;
import com.openframe.data.document.device.Machine;
import com.openframe.security.authentication.AuthPrincipal;
import graphql.relay.Relay;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@DgsComponent
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
@Validated
public class SoftwareBundleDataFetcher {

    private static final Relay RELAY = new Relay();

    private final SoftwareBundleService softwareBundleService;
    private final DeviceService deviceService;
    private final GraphQLDeviceMapper deviceMapper;

    @DgsQuery
    public SoftwareBundleResponse softwareBundle(@InputArgument String id) {
        return softwareBundleService.findById(decodeId(id)).orElse(null);
    }

    @DgsMutation
    public SoftwareBundleResponse createSoftwareBundle() {
        return softwareBundleService.createBundleStub(getCurrentUserId());
    }

    @DgsMutation
    public SoftwareBundleResponse addDevicesToSoftwareBundle(@InputArgument String bundleId,
                                                             @InputArgument List<String> machineIds) {
        return softwareBundleService.addDevices(decodeId(bundleId), decodeMachineIds(machineIds), getCurrentUserId());
    }

    @DgsMutation
    public SoftwareBundleResponse removeDevicesFromSoftwareBundle(@InputArgument String bundleId,
                                                                  @InputArgument List<String> machineIds) {
        return softwareBundleService.removeDevices(decodeId(bundleId), decodeMachineIds(machineIds), getCurrentUserId());
    }

    @DgsMutation
    public SoftwareBundleResponse addAllDevicesToSoftwareBundle(@InputArgument String bundleId,
                                                                @InputArgument @Valid DeviceFilterInput filter,
                                                                @InputArgument String search) {
        List<String> machineIds = deviceService.findAllDeviceIds(deviceMapper.toDeviceFilterCriteria(filter), search);
        return softwareBundleService.addDevices(decodeId(bundleId), machineIds, getCurrentUserId());
    }

    @DgsMutation
    public SoftwareBundleResponse removeAllDevicesFromSoftwareBundle(@InputArgument String bundleId,
                                                                     @InputArgument @Valid DeviceFilterInput filter,
                                                                     @InputArgument String search) {
        List<String> machineIds = deviceService.findAllDeviceIds(deviceMapper.toDeviceFilterCriteria(filter), search);
        return softwareBundleService.removeDevices(decodeId(bundleId), machineIds, getCurrentUserId());
    }

    @DgsMutation
    public SoftwareBundleResponse submitSoftwareBundle(@InputArgument @Valid SubmitSoftwareBundleInput input) {
        input.setId(decodeId(input.getId()));
        return softwareBundleService.submit(input, getCurrentUserId());
    }

    @DgsMutation
    public boolean deleteSoftwareBundle(@InputArgument String id) {
        return softwareBundleService.delete(decodeId(id), getCurrentUserId());
    }

    @DgsData(parentType = "SoftwareBundle", field = "id")
    public String softwareBundleNodeId(DgsDataFetchingEnvironment dfe) {
        SoftwareBundleResponse bundle = dfe.getSource();
        return RELAY.toGlobalId("SoftwareBundle", bundle.getId());
    }

    @DgsData(parentType = "SoftwareBundle", field = "deviceCount")
    public int deviceCount(DgsDataFetchingEnvironment dfe) {
        SoftwareBundleResponse bundle = dfe.getSource();
        return bundle.getMachineIds() == null ? 0 : bundle.getMachineIds().size();
    }

    @DgsData(parentType = "SoftwareBundle", field = "assignedDevices")
    public CountedGenericConnection<GenericEdge<Machine>> assignedDevices(
            DgsDataFetchingEnvironment dfe,
            @InputArgument @Valid DeviceFilterInput filter,
            @InputArgument Integer first,
            @InputArgument String after,
            @InputArgument Integer last,
            @InputArgument String before,
            @InputArgument String search,
            @InputArgument @Valid SortInput sort) {
        SoftwareBundleResponse bundle = dfe.getSource();
        List<String> machineIds = bundle.getMachineIds() == null ? List.of() : bundle.getMachineIds();
        DeviceFilterCriteria filterOptions = deviceMapper.toDeviceFilterCriteria(filter);
        CursorPaginationCriteria pagination = deviceMapper.toCursorPaginationCriteria(
                ConnectionArgs.builder().first(first).after(after).last(last).before(before).build());
        CountedGenericQueryResult<Machine> result =
                deviceService.queryAssignedDevices(machineIds, filterOptions, pagination, search, sort);
        return deviceMapper.toDeviceConnection(result);
    }

    @DgsData(parentType = "SoftwareBundle", field = "availableDevices")
    public CountedGenericConnection<AvailableDeviceEdge> availableDevices(
            DgsDataFetchingEnvironment dfe,
            @InputArgument @Valid DeviceFilterInput filter,
            @InputArgument Integer first,
            @InputArgument String after,
            @InputArgument Integer last,
            @InputArgument String before,
            @InputArgument String search,
            @InputArgument @Valid SortInput sort) {
        SoftwareBundleResponse bundle = dfe.getSource();
        DeviceFilterCriteria filterOptions = deviceMapper.toDeviceFilterCriteria(filter);
        CursorPaginationCriteria pagination = deviceMapper.toCursorPaginationCriteria(
                ConnectionArgs.builder().first(first).after(after).last(last).before(before).build());
        Set<String> assignedMachineIds = new HashSet<>(bundle.getMachineIds() == null ? List.of() : bundle.getMachineIds());
        // No OS restriction at device-selection time — packages (and thus platforms) are chosen at submit.
        CountedGenericQueryResult<Machine> result = deviceService.queryAvailableDevicesForSchedule(
                null, assignedMachineIds, filterOptions, pagination, search);
        return deviceMapper.toAvailableDeviceConnection(result, assignedMachineIds);
    }

    @DgsData(parentType = "SoftwareBundle", field = "assignedDeviceFilters")
    public DeviceFilters assignedDeviceFilters(
            DgsDataFetchingEnvironment dfe,
            @InputArgument @Valid DeviceFilterInput filter,
            @InputArgument String search) {
        SoftwareBundleResponse bundle = dfe.getSource();
        List<String> machineIds = bundle.getMachineIds() == null ? List.of() : bundle.getMachineIds();
        DeviceFilterCriteria filterOptions = deviceMapper.toDeviceFilterCriteria(filter);
        return deviceService.getAssignedDeviceFilters(machineIds, filterOptions, search);
    }

    @DgsData(parentType = "SoftwareBundle", field = "availableDeviceFilters")
    public DeviceFilters availableDeviceFilters(
            DgsDataFetchingEnvironment dfe,
            @InputArgument @Valid DeviceFilterInput filter,
            @InputArgument String search) {
        DeviceFilterCriteria filterOptions = deviceMapper.toDeviceFilterCriteria(filter);
        return deviceService.getAvailableDeviceFilters(null, filterOptions, search);
    }

    private static List<String> decodeMachineIds(List<String> machineIds) {
        if (machineIds == null) {
            return List.of();
        }
        return machineIds.stream().map(SoftwareBundleDataFetcher::decodeId).toList();
    }

    private static String decodeId(String id) {
        try {
            return RELAY.fromGlobalId(id).getId();
        } catch (Exception e) {
            return id;
        }
    }

    private String getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return AuthPrincipal.fromJwt((Jwt) auth.getPrincipal()).getId();
    }
}
