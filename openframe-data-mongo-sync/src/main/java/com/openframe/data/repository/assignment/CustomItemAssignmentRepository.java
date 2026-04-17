package com.openframe.data.repository.assignment;

import com.openframe.data.document.assignment.AssignmentTargetType;
import com.openframe.data.document.assignment.ItemAssignment;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;
import java.util.Map;

public interface CustomItemAssignmentRepository {

    Query buildAssignmentQuery(String itemId, AssignmentTargetType targetType, String search);

    List<ItemAssignment> findAssignmentsWithCursor(Query query, String cursor, int limit,
                                                    String sortField, String sortDirection);

    long countAssignments(Query query);

    Map<AssignmentTargetType, Long> countByItemIdGroupedByTargetType(String itemId);

    boolean isSortableField(String field);

    String getDefaultSortField();
}
