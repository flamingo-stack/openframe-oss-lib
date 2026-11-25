package com.openframe.api.datafetcher.rmm;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.GenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.rmm.osupdate.DeviceOsPendingUpdateResponse;
import com.openframe.api.dto.rmm.osupdate.DeviceOsStateResponse;
import com.openframe.api.dto.rmm.osupdate.DeviceOsUpdateHistoryEntryResponse;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.mapper.DeviceOsGraphQLMapper;
import com.openframe.api.service.rmm.osupdate.DeviceOsPendingUpdateService;
import com.openframe.api.service.rmm.osupdate.DeviceOsStateService;
import com.openframe.api.service.rmm.osupdate.DeviceOsUpdateHistoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

import java.util.List;

@DgsComponent
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
@RequiredArgsConstructor
public class DeviceOsDataFetcher {

    private final DeviceOsStateService deviceOsStateService;
    private final DeviceOsPendingUpdateService deviceOsPendingUpdateService;
    private final DeviceOsUpdateHistoryService deviceOsUpdateHistoryService;
    private final DeviceOsGraphQLMapper deviceOsGraphQLMapper;

    @DgsQuery
    public DeviceOsStateResponse deviceOsState(@InputArgument String machineId) {
        return deviceOsStateService.findOsState(machineId);
    }

    @DgsQuery
    public List<DeviceOsPendingUpdateResponse> deviceOsPendingUpdates(@InputArgument String machineId) {
        return deviceOsPendingUpdateService.listPendingUpdates(machineId);
    }

    @DgsQuery
    public GenericConnection<GenericEdge<DeviceOsUpdateHistoryEntryResponse>> deviceOsUpdateHistory(
            @InputArgument String machineId, @InputArgument Integer first, @InputArgument String after) {
        CursorPaginationCriteria pagination = deviceOsGraphQLMapper.toCursorPaginationCriteria(first, after);
        GenericQueryResult<DeviceOsUpdateHistoryEntryResponse> updateHistory =
                deviceOsUpdateHistoryService.listUpdateHistory(machineId, pagination);
        return deviceOsGraphQLMapper.toConnection(updateHistory);
    }
}
