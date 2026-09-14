package com.openframe.api.mapper;

import com.openframe.api.dto.GenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.device.DeviceLogEntry;
import com.openframe.api.dto.device.DeviceLogFilterCriteria;
import com.openframe.api.dto.device.DeviceLogFilterInput;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.List;

@Component
public class GraphQLDeviceLogMapper {

    public DeviceLogFilterCriteria toFilterCriteria(DeviceLogFilterInput input) {
        if (input == null) {
            return DeviceLogFilterCriteria.builder().build();
        }
        return DeviceLogFilterCriteria.builder()
                .levels(input.getLevels())
                .search(input.getSearch())
                .from(input.getFrom())
                .to(input.getTo())
                .build();
    }

    /**
     * Rejects an undecodable {@code after} instead of letting the shared helper silently restart at page one,
     * which would make an infinite-scroll client loop over the newest entries.
     */
    public CursorPaginationCriteria toCursorPaginationCriteria(Integer first, String after) {
        if (StringUtils.hasText(after) && CursorCodec.decode(after) == null) {
            throw new IllegalArgumentException("Invalid cursor");
        }
        return CursorPaginationCriteria.fromConnectionArgs(ConnectionArgs.builder().first(first).after(after).build());
    }

    public GenericConnection<GenericEdge<DeviceLogEntry>> toConnection(GenericQueryResult<DeviceLogEntry> result) {
        List<GenericEdge<DeviceLogEntry>> edges = result.getItems().stream()
                .map(entry -> GenericEdge.<DeviceLogEntry>builder()
                        .node(entry)
                        .cursor(entry.getCursor())
                        .build())
                .toList();

        return GenericConnection.<GenericEdge<DeviceLogEntry>>builder()
                .edges(edges)
                .pageInfo(result.getPageInfo())
                .build();
    }
}
