package com.openframe.data.repository.knowledgebase;

import com.openframe.data.document.knowledgebase.KnowledgeBaseImage;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface KnowledgeBaseImageRepository extends MongoRepository<KnowledgeBaseImage, String> {
}
