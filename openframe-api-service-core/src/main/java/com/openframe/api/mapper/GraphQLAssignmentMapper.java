package com.openframe.api.mapper;

import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.assignment.AssignedItemCount;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.data.document.assignment.AssignmentTargetType;
import com.openframe.data.document.assignment.ItemAssignment;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Component
public class GraphQLAssignmentMapper {

    public CursorPaginationCriteria toCursorPaginationCriteria(ConnectionArgs args) {
        return CursorPaginationCriteria.fromConnectionArgs(args);
    }

    public List<AssignedItemCount> toAssignedItemCounts(Map<AssignmentTargetType, Long> counts) {
        return counts.entrySet().stream()
                .map(e -> AssignedItemCount.builder()
                        .targetType(e.getKey())
                        .count(e.getValue().intValue())
                        .build())
                .collect(Collectors.toList());
    }

    public CountedGenericConnection<GenericEdge<ItemAssignment>> toAssignmentConnection(
            CountedGenericQueryResult<ItemAssignment> result) {
        List<GenericEdge<ItemAssignment>> edges = result.getItems().stream()
                .map(a -> GenericEdge.<ItemAssignment>builder()
                        .node(a)
                        .cursor(CursorCodec.encode(a.getId()))
                        .build())
                .collect(Collectors.toList());
        return CountedGenericConnection.<GenericEdge<ItemAssignment>>builder()
                .edges(edges)
                .pageInfo(result.getPageInfo())
                .filteredCount(result.getFilteredCount())
                .build();
    }
}
