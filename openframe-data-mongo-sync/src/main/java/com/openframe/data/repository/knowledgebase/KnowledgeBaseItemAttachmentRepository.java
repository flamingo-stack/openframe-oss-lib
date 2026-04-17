package com.openframe.data.repository.knowledgebase;

import com.openframe.data.document.knowledgebase.KnowledgeBaseItemAttachment;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface KnowledgeBaseItemAttachmentRepository extends MongoRepository<KnowledgeBaseItemAttachment, String> {

    List<KnowledgeBaseItemAttachment> findByItemId(String itemId);

    List<KnowledgeBaseItemAttachment> findByItemIdIn(List<String> itemIds);

    void deleteByItemId(String itemId);
}
