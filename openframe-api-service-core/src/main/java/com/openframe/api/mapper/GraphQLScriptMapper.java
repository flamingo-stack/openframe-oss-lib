package com.openframe.api.mapper;

import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.rmm.script.ScriptResponse;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * GraphQL-layer mapper for scripts: Relay Connection envelope assembly and
 * {@link ConnectionArgs} &rarr; {@link CursorPaginationCriteria} conversion.
 *
 * <p>Pure entity &harr; DTO mapping lives in {@link ScriptMapper} in
 * {@code openframe-api-lib} so non-GraphQL callers can reuse it without
 * pulling in DGS / Relay types.
 *
 * <p>Mirrors the same split as {@code GraphQLDeviceMapper} /
 * {@code GraphQLNotificationMapper}.
 */
@Component
public class GraphQLScriptMapper {

    public CursorPaginationCriteria toCursorPaginationCriteria(ConnectionArgs args) {
        return CursorPaginationCriteria.fromConnectionArgs(args);
    }

    public CountedGenericConnection<GenericEdge<ScriptResponse>> toConnection(
            CountedGenericQueryResult<ScriptResponse> result) {
        List<GenericEdge<ScriptResponse>> edges = result.getItems().stream()
                .map(view -> GenericEdge.<ScriptResponse>builder()
                        .node(view)
                        .cursor(CursorCodec.encode(view.getId()))
                        .build())
                .toList();

        return CountedGenericConnection.<GenericEdge<ScriptResponse>>builder()
                .edges(edges)
                .pageInfo(result.getPageInfo())
                .filteredCount(result.getFilteredCount())
                .build();
    }
}
