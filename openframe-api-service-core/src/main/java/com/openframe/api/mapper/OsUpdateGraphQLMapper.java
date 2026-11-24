package com.openframe.api.mapper;

import com.openframe.api.dto.GenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceResponse;
import com.openframe.api.dto.rmm.osupdate.OsUpdateFilterInput;
import com.openframe.api.dto.rmm.osupdate.OsUpdateResponse;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.data.repository.rmm.osupdate.OsUpdateFilter;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.function.Function;

@Component
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
public class OsUpdateGraphQLMapper {

    public OsUpdateFilter toOsUpdateFilter(OsUpdateFilterInput osUpdateFilterInput) {
        if (osUpdateFilterInput == null) {
            return OsUpdateFilter.NONE;
        }
        return OsUpdateFilter.builder()
                .platform(osUpdateFilterInput.getPlatform())
                .classifications(osUpdateFilterInput.getClassifications())
                .search(osUpdateFilterInput.getSearch())
                .build();
    }

    public CursorPaginationCriteria toCursorPaginationCriteria(Integer first, String after) {
        ConnectionArgs connectionArgs = ConnectionArgs.builder().first(first).after(after).build();
        return CursorPaginationCriteria.fromConnectionArgs(connectionArgs);
    }

    public GenericConnection<GenericEdge<OsUpdateResponse>> toOsUpdateConnection(
            GenericQueryResult<OsUpdateResponse> osUpdates) {
        return toConnection(osUpdates, OsUpdateResponse::getCursor);
    }

    public GenericConnection<GenericEdge<OsUpdateDeviceResponse>> toDeviceConnection(
            GenericQueryResult<OsUpdateDeviceResponse> devices) {
        return toConnection(devices, OsUpdateDeviceResponse::getCursor);
    }

    private static <T> GenericConnection<GenericEdge<T>> toConnection(GenericQueryResult<T> queryResult,
                                                                      Function<T, String> cursorReader) {
        List<GenericEdge<T>> edges = queryResult.getItems().stream()
                .map(item -> toEdge(item, cursorReader.apply(item)))
                .toList();
        return GenericConnection.<GenericEdge<T>>builder()
                .edges(edges)
                .pageInfo(queryResult.getPageInfo())
                .build();
    }

    private static <T> GenericEdge<T> toEdge(T node, String cursor) {
        return GenericEdge.<T>builder()
                .node(node)
                .cursor(cursor)
                .build();
    }
}
