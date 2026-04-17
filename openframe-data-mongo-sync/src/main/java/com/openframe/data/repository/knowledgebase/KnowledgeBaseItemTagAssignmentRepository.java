package com.openframe.data.repository.knowledgebase;

import com.openframe.data.document.knowledgebase.KnowledgeBaseItemTagAssignment;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface KnowledgeBaseItemTagAssignmentRepository extends MongoRepository<KnowledgeBaseItemTagAssignment, String> {

    List<KnowledgeBaseItemTagAssignment> findByItemId(String itemId);

    List<KnowledgeBaseItemTagAssignment> findByItemIdIn(List<String> itemIds);

    void deleteByItemIdAndTagId(String itemId, String tagId);

    void deleteByItemId(String itemId);
}
