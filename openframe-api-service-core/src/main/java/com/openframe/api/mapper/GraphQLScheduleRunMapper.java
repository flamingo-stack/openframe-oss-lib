package com.openframe.api.mapper;

import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.rmm.schedulerun.ScheduleRunResponse;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * GraphQL-layer mapper for the Schedule Runs list — Relay Connection envelope assembly +
 * {@link ConnectionArgs} → {@link CursorPaginationCriteria} conversion. Mirrors
 * {@code GraphQLScriptExecutionMapper}.
 */
@Component
public class GraphQLScheduleRunMapper {

    public CursorPaginationCriteria toCursorPaginationCriteria(ConnectionArgs args) {
        return CursorPaginationCriteria.fromConnectionArgs(args);
    }

    public CountedGenericConnection<GenericEdge<ScheduleRunResponse>> toConnection(CountedGenericQueryResult<ScheduleRunResponse> result) {
        List<GenericEdge<ScheduleRunResponse>> edges = result.getItems().stream()
                .map(view -> GenericEdge.<ScheduleRunResponse>builder()
                        .node(view)
                        .cursor(CursorCodec.encode(view.getId()))
                        .build())
                .toList();

        return CountedGenericConnection.<GenericEdge<ScheduleRunResponse>>builder()
                .edges(edges)
                .pageInfo(result.getPageInfo())
                .filteredCount(result.getFilteredCount())
                .build();
    }
}
