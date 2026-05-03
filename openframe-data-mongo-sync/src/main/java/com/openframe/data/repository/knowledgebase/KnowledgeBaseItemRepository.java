package com.openframe.data.repository.knowledgebase;

import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemType;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface KnowledgeBaseItemRepository extends MongoRepository<KnowledgeBaseItem, String>, CustomKnowledgeBaseItemRepository {

    List<KnowledgeBaseItem> findByParentIdAndType(String parentId, KnowledgeBaseItemType type);

    List<KnowledgeBaseItem> findByParentId(String parentId);

    List<KnowledgeBaseItem> findByIdIn(List<String> ids);

    List<KnowledgeBaseItem> findByTypeOrderByNameAsc(KnowledgeBaseItemType type);
}
