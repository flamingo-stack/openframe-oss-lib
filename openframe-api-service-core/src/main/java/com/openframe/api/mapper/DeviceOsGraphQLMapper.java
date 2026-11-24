package com.openframe.api.mapper;

import com.openframe.api.dto.GenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.rmm.osupdate.DeviceOsUpdateHistoryEntryResponse;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
public class DeviceOsGraphQLMapper {

    public CursorPaginationCriteria toCursorPaginationCriteria(Integer first, String after) {
        ConnectionArgs connectionArgs = ConnectionArgs.builder().first(first).after(after).build();
        return CursorPaginationCriteria.fromConnectionArgs(connectionArgs);
    }

    public GenericConnection<GenericEdge<DeviceOsUpdateHistoryEntryResponse>> toConnection(
            GenericQueryResult<DeviceOsUpdateHistoryEntryResponse> updateHistory) {
        List<GenericEdge<DeviceOsUpdateHistoryEntryResponse>> edges = updateHistory.getItems().stream()
                .map(DeviceOsGraphQLMapper::toEdge)
                .toList();
        return GenericConnection.<GenericEdge<DeviceOsUpdateHistoryEntryResponse>>builder()
                .edges(edges)
                .pageInfo(updateHistory.getPageInfo())
                .build();
    }

    private static GenericEdge<DeviceOsUpdateHistoryEntryResponse> toEdge(
            DeviceOsUpdateHistoryEntryResponse historyEntry) {
        return GenericEdge.<DeviceOsUpdateHistoryEntryResponse>builder()
                .node(historyEntry)
                .cursor(historyEntry.getCursor())
                .build();
    }
}
