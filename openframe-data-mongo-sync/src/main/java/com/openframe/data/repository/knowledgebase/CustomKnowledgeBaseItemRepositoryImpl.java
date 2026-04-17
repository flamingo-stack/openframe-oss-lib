package com.openframe.data.repository.knowledgebase;

import com.openframe.data.document.knowledgebase.KnowledgeBaseArticleStatus;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemType;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;

public class CustomKnowledgeBaseItemRepositoryImpl implements CustomKnowledgeBaseItemRepository {

    private final MongoTemplate mongoTemplate;

    public CustomKnowledgeBaseItemRepositoryImpl(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public List<KnowledgeBaseItem> searchPublishedArticles(String search, String folderId) {
        Criteria criteria = Criteria.where("type").is(KnowledgeBaseItemType.ARTICLE)
                .and("status").is(KnowledgeBaseArticleStatus.PUBLISHED);

        if (folderId != null && !folderId.isBlank()) {
            criteria = criteria.and("parentId").is(folderId);
        }

        if (search != null && !search.isBlank()) {
            criteria = criteria.orOperator(
                    Criteria.where("name").regex(search, "i"),
                    Criteria.where("summary").regex(search, "i")
            );
        }

        Query query = new Query(criteria);
        return mongoTemplate.find(query, KnowledgeBaseItem.class);
    }

    @Override
    public List<String> findDistinctFolderNames() {
        Query query = new Query(Criteria.where("type").is(KnowledgeBaseItemType.FOLDER));
        return mongoTemplate.findDistinct(query, "name", KnowledgeBaseItem.class, String.class);
    }
}
