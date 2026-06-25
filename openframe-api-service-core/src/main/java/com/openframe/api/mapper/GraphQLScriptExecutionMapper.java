package com.openframe.api.mapper;

import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.execution.ScriptExecutionResponse;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * GraphQL-layer mapper for executions — Relay Connection envelope assembly +
 * {@link ConnectionArgs} → {@link CursorPaginationCriteria} conversion.
 * Mirrors {@code GraphQLScriptMapper} exactly; entity ↔ DTO logic lives in
 * {@link ScriptExecutionMapper} in {@code openframe-api-lib}.
 */
@Component
public class GraphQLScriptExecutionMapper {

    public CursorPaginationCriteria toCursorPaginationCriteria(ConnectionArgs args) {
        return CursorPaginationCriteria.fromConnectionArgs(args);
    }

    public CountedGenericConnection<GenericEdge<ScriptExecutionResponse>> toConnection(
            CountedGenericQueryResult<ScriptExecutionResponse> result) {
        List<GenericEdge<ScriptExecutionResponse>> edges = result.getItems().stream()
                .map(view -> GenericEdge.<ScriptExecutionResponse>builder()
                        .node(view)
                        .cursor(CursorCodec.encode(view.getId()))
                        .build())
                .toList();

        return CountedGenericConnection.<GenericEdge<ScriptExecutionResponse>>builder()
                .edges(edges)
                .pageInfo(result.getPageInfo())
                .filteredCount(result.getFilteredCount())
                .build();
    }
}
