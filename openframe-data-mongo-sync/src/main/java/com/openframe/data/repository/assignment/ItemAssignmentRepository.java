package com.openframe.data.repository.assignment;

import com.openframe.data.document.assignment.AssignmentTargetType;
import com.openframe.data.document.assignment.ItemAssignment;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ItemAssignmentRepository extends MongoRepository<ItemAssignment, String>, CustomItemAssignmentRepository {

    void deleteByItemIdAndTargetTypeAndTargetId(String itemId, AssignmentTargetType targetType, String targetId);

    void deleteByItemIdAndTargetType(String itemId, AssignmentTargetType targetType);
}
