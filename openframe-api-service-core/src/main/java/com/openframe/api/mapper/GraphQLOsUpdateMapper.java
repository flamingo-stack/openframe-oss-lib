package com.openframe.api.mapper;

import com.openframe.api.dto.GenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.rmm.osupdate.DeviceOsUpdateHistoryEntryResponse;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;


@Component
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
public class GraphQLOsUpdateMapper {

    public CursorPaginationCriteria toCursorPaginationCriteria(Integer first, String after) {
        return CursorPaginationCriteria.fromConnectionArgs(ConnectionArgs.builder().first(first).after(after).build());
    }

    public GenericConnection<GenericEdge<DeviceOsUpdateHistoryEntryResponse>> toConnection(
            GenericQueryResult<DeviceOsUpdateHistoryEntryResponse> result) {
        return GenericConnection.<GenericEdge<DeviceOsUpdateHistoryEntryResponse>>builder()
                .edges(result.getItems().stream().map(GraphQLOsUpdateMapper::toEdge).toList())
                .pageInfo(result.getPageInfo())
                .build();
    }

    private static GenericEdge<DeviceOsUpdateHistoryEntryResponse> toEdge(DeviceOsUpdateHistoryEntryResponse entry) {
        return GenericEdge.<DeviceOsUpdateHistoryEntryResponse>builder()
                .node(entry)
                .cursor(entry.getCursor())
                .build();
    }
}
