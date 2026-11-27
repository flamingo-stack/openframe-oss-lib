package com.openframe.data.repository.assignment;

import com.openframe.data.document.assignment.AssignmentItemType;
import com.openframe.data.document.assignment.AssignmentTargetType;
import com.openframe.data.document.assignment.ItemAssignment;
import com.openframe.data.repository.cursor.CursorPosition;
import com.openframe.data.repository.cursor.KeysetCursor;

import java.util.List;
import java.util.Map;

public interface CustomItemAssignmentRepository {

    List<ItemAssignment> findAssignmentsWithCursor(String itemId, AssignmentTargetType targetType,
                                                    String search, String sortField, String sortDirection,
                                                    CursorPosition position, boolean backward, int limit);

    KeysetCursor keysetCursor(ItemAssignment assignment, String sortField, String sortDirection);

    long countAssignments(String itemId, AssignmentTargetType targetType, String search);

    Map<AssignmentTargetType, Long> countByItemIdGroupedByTargetType(String itemId);

    List<String> findItemIdsByTarget(AssignmentItemType itemType, AssignmentTargetType targetType, String targetId);

    boolean isSortableField(String field);

    String getDefaultSortField();
}
