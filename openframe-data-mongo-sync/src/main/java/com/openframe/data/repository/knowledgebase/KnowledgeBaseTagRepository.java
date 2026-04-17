package com.openframe.data.repository.knowledgebase;

import com.openframe.data.document.knowledgebase.KnowledgeBaseTag;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface KnowledgeBaseTagRepository extends MongoRepository<KnowledgeBaseTag, String> {

    Optional<KnowledgeBaseTag> findByName(String name);

    List<KnowledgeBaseTag> findByIdIn(List<String> ids);
}
