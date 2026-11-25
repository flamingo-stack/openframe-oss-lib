package com.openframe.api.datafetcher.rmm;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsData;
import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dataloader.OsUpdateDeviceCountsKey;
import com.openframe.api.dto.GenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceCounts;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceResponse;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceStatus;
import com.openframe.api.dto.rmm.osupdate.OsUpdateFilterInput;
import com.openframe.api.dto.rmm.osupdate.OsUpdateResponse;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.mapper.OsUpdateGraphQLMapper;
import com.openframe.api.service.rmm.osupdate.OsUpdateQueryService;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.rmm.osupdate.OsUpdateFilter;
import graphql.execution.DataFetcherResult;
import lombok.RequiredArgsConstructor;
import org.dataloader.DataLoader;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

@DgsComponent
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
@RequiredArgsConstructor
public class OsUpdateDataFetcher {

    private static final String DEVICE_COUNTS_DATA_LOADER = "osUpdateDeviceCountsDataLoader";
    private static final String MACHINE_DATA_LOADER = "machineDataLoader";

    private final OsUpdateQueryService osUpdateQueryService;
    private final OsUpdateGraphQLMapper osUpdateGraphQLMapper;

    @DgsQuery
    // The organizations go down as the local context: the device counts of the listed updates read them.
    public DataFetcherResult<GenericConnection<GenericEdge<OsUpdateResponse>>> osUpdates(
            @InputArgument OsUpdateFilterInput filter, @InputArgument Integer first, @InputArgument String after) {
        OsUpdateFilter osUpdateFilter = osUpdateGraphQLMapper.toOsUpdateFilter(filter);
        List<String> organizationIds = osUpdateGraphQLMapper.toOrganizationIds(filter);
        CursorPaginationCriteria pagination = osUpdateGraphQLMapper.toCursorPaginationCriteria(first, after);
        GenericQueryResult<OsUpdateResponse> osUpdates =
                osUpdateQueryService.listOsUpdates(osUpdateFilter, organizationIds, pagination);
        return DataFetcherResult.<GenericConnection<GenericEdge<OsUpdateResponse>>>newResult()
                .data(osUpdateGraphQLMapper.toOsUpdateConnection(osUpdates))
                .localContext(organizationIds)
                .build();
    }

    @DgsQuery
    public OsUpdateResponse osUpdate(@InputArgument String id) {
        Optional<OsUpdateResponse> osUpdate = osUpdateQueryService.findOsUpdate(id);
        return osUpdate.orElse(null);
    }

    @DgsQuery
    public GenericConnection<GenericEdge<OsUpdateDeviceResponse>> osUpdateDevices(
            @InputArgument String osUpdateId, @InputArgument OsUpdateDeviceStatus status,
            @InputArgument List<String> organizationIds, @InputArgument Integer first, @InputArgument String after) {
        CursorPaginationCriteria pagination = osUpdateGraphQLMapper.toCursorPaginationCriteria(first, after);
        GenericQueryResult<OsUpdateDeviceResponse> devices =
                osUpdateQueryService.listDevices(osUpdateId, status, organizationIds, pagination);
        return osUpdateGraphQLMapper.toDeviceConnection(devices);
    }

    @DgsData(parentType = "OsUpdate", field = "pendingDeviceCount")
    public CompletableFuture<Integer> pendingDeviceCount(DgsDataFetchingEnvironment dfe) {
        return loadDeviceCounts(dfe).thenApply(OsUpdateDeviceCounts::getPendingDeviceCount);
    }

    @DgsData(parentType = "OsUpdate", field = "installedDeviceCount")
    public CompletableFuture<Integer> installedDeviceCount(DgsDataFetchingEnvironment dfe) {
        return loadDeviceCounts(dfe).thenApply(OsUpdateDeviceCounts::getInstalledDeviceCount);
    }

    @DgsData(parentType = "OsUpdateDevice", field = "machine")
    public CompletableFuture<Machine> machine(DgsDataFetchingEnvironment dfe) {
        OsUpdateDeviceResponse device = dfe.getSource();
        DataLoader<String, Machine> machineDataLoader = dfe.getDataLoader(MACHINE_DATA_LOADER);
        return machineDataLoader.load(device.getMachineId());
    }

    // Asking for both counts of one update loads them once: the loader keeps what it loaded for the request.
    private static CompletableFuture<OsUpdateDeviceCounts> loadDeviceCounts(DgsDataFetchingEnvironment dfe) {
        OsUpdateResponse osUpdate = dfe.getSource();
        List<String> organizationIds = Objects.requireNonNullElse(dfe.getLocalContext(), List.of());
        OsUpdateDeviceCountsKey osUpdateDeviceCountsKey = OsUpdateDeviceCountsKey.builder()
                .osUpdateId(osUpdate.getId())
                .organizationIds(organizationIds)
                .build();
        DataLoader<OsUpdateDeviceCountsKey, OsUpdateDeviceCounts> deviceCountsDataLoader =
                dfe.getDataLoader(DEVICE_COUNTS_DATA_LOADER);
        return deviceCountsDataLoader.load(osUpdateDeviceCountsKey);
    }
}
