package com.openframe.data.repository.assignment;

import com.openframe.data.document.assignment.AssignmentTargetType;
import com.openframe.data.document.assignment.ItemAssignment;

import java.util.List;
import java.util.Map;

public interface CustomItemAssignmentRepository {

    List<ItemAssignment> findAssignmentsWithCursor(String itemId, AssignmentTargetType targetType,
                                                    String search, String sortField, String sortDirection,
                                                    String cursor, int limit);

    long countAssignments(String itemId, AssignmentTargetType targetType, String search);

    Map<AssignmentTargetType, Long> countByItemIdGroupedByTargetType(String itemId);

    boolean isSortableField(String field);

    String getDefaultSortField();
}
