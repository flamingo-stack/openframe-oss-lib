package com.openframe.api.datafetcher.rmm;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.GenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.rmm.osupdate.DeviceOsUpdateHistoryEntryResponse;
import com.openframe.api.dto.rmm.osupdate.DeviceOsUpdateResponse;
import com.openframe.api.mapper.GraphQLOsUpdateMapper;
import com.openframe.api.service.rmm.osupdate.OsUpdateService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

import java.util.List;

@DgsComponent
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
@RequiredArgsConstructor
public class OsUpdateDataFetcher {

    private final OsUpdateService osUpdateService;
    private final GraphQLOsUpdateMapper graphQLOsUpdateMapper;

    @DgsQuery
    public List<DeviceOsUpdateResponse> deviceOsUpdates(@InputArgument String machineId) {
        return osUpdateService.listPendingForDevice(machineId);
    }

    @DgsQuery
    public GenericConnection<GenericEdge<DeviceOsUpdateHistoryEntryResponse>> deviceOsUpdateHistory(
            @InputArgument String machineId, @InputArgument Integer first, @InputArgument String after) {
        GenericQueryResult<DeviceOsUpdateHistoryEntryResponse> history = osUpdateService.listHistoryForDevice(
                machineId, graphQLOsUpdateMapper.toCursorPaginationCriteria(first, after));
        return graphQLOsUpdateMapper.toConnection(history);
    }
}
