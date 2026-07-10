package com.openframe.api.mapper;

import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.rmm.schedule.ScriptScheduleResponse;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * GraphQL-layer mapper for script schedules: Relay Connection envelope assembly
 * and {@link ConnectionArgs} &rarr; {@link CursorPaginationCriteria} conversion.
 * Mirrors {@link GraphQLScriptMapper}; pure entity &harr; DTO mapping lives in
 * {@code ScriptScheduleMapper} in {@code openframe-api-lib}.
 */
@Component
public class GraphQLScriptScheduleMapper {

    public CursorPaginationCriteria toCursorPaginationCriteria(ConnectionArgs args) {
        return CursorPaginationCriteria.fromConnectionArgs(args);
    }

    public CountedGenericConnection<GenericEdge<ScriptScheduleResponse>> toConnection(
            CountedGenericQueryResult<ScriptScheduleResponse> result) {
        List<GenericEdge<ScriptScheduleResponse>> edges = result.getItems().stream()
                .map(view -> GenericEdge.<ScriptScheduleResponse>builder()
                        .node(view)
                        .cursor(CursorCodec.encode(view.getId()))
                        .build())
                .toList();

        return CountedGenericConnection.<GenericEdge<ScriptScheduleResponse>>builder()
                .edges(edges)
                .pageInfo(result.getPageInfo())
                .filteredCount(result.getFilteredCount())
                .build();
    }
}
