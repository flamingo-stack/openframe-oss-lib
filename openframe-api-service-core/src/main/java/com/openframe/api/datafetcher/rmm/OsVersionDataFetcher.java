package com.openframe.api.datafetcher.rmm;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsData;
import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.GenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.rmm.osupdate.OsVersionDeviceResponse;
import com.openframe.api.dto.rmm.osupdate.OsVersionFilterInput;
import com.openframe.api.dto.rmm.osupdate.OsVersionResponse;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.mapper.OsUpdateGraphQLMapper;
import com.openframe.api.service.rmm.osupdate.OsVersionService;
import com.openframe.data.document.device.Machine;
import lombok.RequiredArgsConstructor;
import org.dataloader.DataLoader;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

import java.util.List;
import java.util.concurrent.CompletableFuture;

@DgsComponent
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
@RequiredArgsConstructor
public class OsVersionDataFetcher {

    private static final String MACHINE_DATA_LOADER = "machineDataLoader";

    private final OsVersionService osVersionService;
    private final OsUpdateGraphQLMapper osUpdateGraphQLMapper;

    @DgsQuery
    public GenericConnection<GenericEdge<OsVersionResponse>> osVersions(
            @InputArgument OsVersionFilterInput filter, @InputArgument Integer first, @InputArgument String after) {
        List<String> organizationIds = filter == null ? null : filter.getOrganizationIds();
        CursorPaginationCriteria pagination = osUpdateGraphQLMapper.toCursorPaginationCriteria(first, after);
        GenericQueryResult<OsVersionResponse> osVersions = osVersionService.listOsVersions(organizationIds, pagination);
        return osUpdateGraphQLMapper.toOsVersionConnection(osVersions);
    }

    @DgsQuery
    public GenericConnection<GenericEdge<OsVersionDeviceResponse>> osVersionDevices(
            @InputArgument String osVersion, @InputArgument List<String> organizationIds,
            @InputArgument Integer first, @InputArgument String after) {
        CursorPaginationCriteria pagination = osUpdateGraphQLMapper.toCursorPaginationCriteria(first, after);
        GenericQueryResult<OsVersionDeviceResponse> devices =
                osVersionService.listOsVersionDevices(osVersion, organizationIds, pagination);
        return osUpdateGraphQLMapper.toOsVersionDeviceConnection(devices);
    }

    @DgsData(parentType = "OsVersionDevice", field = "machine")
    public CompletableFuture<Machine> machine(DgsDataFetchingEnvironment dfe) {
        OsVersionDeviceResponse device = dfe.getSource();
        DataLoader<String, Machine> machineDataLoader = dfe.getDataLoader(MACHINE_DATA_LOADER);
        return machineDataLoader.load(device.getMachineId());
    }
}
