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
        List<GenericEdge<OsUpdateResponse>> edges = osUpdates.getItems().stream()
                .map(OsUpdateGraphQLMapper::toEdge)
                .toList();
        return GenericConnection.<GenericEdge<OsUpdateResponse>>builder()
                .edges(edges)
                .pageInfo(osUpdates.getPageInfo())
                .build();
    }

    public GenericConnection<GenericEdge<OsUpdateDeviceResponse>> toDeviceConnection(
            GenericQueryResult<OsUpdateDeviceResponse> devices) {
        List<GenericEdge<OsUpdateDeviceResponse>> edges = devices.getItems().stream()
                .map(OsUpdateGraphQLMapper::toEdge)
                .toList();
        return GenericConnection.<GenericEdge<OsUpdateDeviceResponse>>builder()
                .edges(edges)
                .pageInfo(devices.getPageInfo())
                .build();
    }

    private static GenericEdge<OsUpdateResponse> toEdge(OsUpdateResponse osUpdate) {
        return GenericEdge.<OsUpdateResponse>builder()
                .node(osUpdate)
                .cursor(osUpdate.getCursor())
                .build();
    }

    private static GenericEdge<OsUpdateDeviceResponse> toEdge(OsUpdateDeviceResponse device) {
        return GenericEdge.<OsUpdateDeviceResponse>builder()
                .node(device)
                .cursor(device.getCursor())
                .build();
    }
}
