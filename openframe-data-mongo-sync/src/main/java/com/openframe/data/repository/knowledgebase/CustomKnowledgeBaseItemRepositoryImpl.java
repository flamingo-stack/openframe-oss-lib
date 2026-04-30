package com.openframe.data.repository.knowledgebase;

import com.openframe.data.document.knowledgebase.KnowledgeBaseArticleStatus;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemType;
import lombok.extern.slf4j.Slf4j;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.util.StringUtils;

import java.util.List;

@Slf4j
public class CustomKnowledgeBaseItemRepositoryImpl implements CustomKnowledgeBaseItemRepository {

    private static final String FIELD_TYPE = "type";
    private static final String FIELD_PARENT_ID = "parentId";
    private static final String FIELD_NAME = "name";
    private static final String FIELD_SUMMARY = "summary";
    private static final String FIELD_STATUS = "status";
    private static final String FIELD_CREATED_BY = "createdBy";
    private static final String FIELD_UPDATED_AT = "updatedAt";
    private static final String ID_FIELD = "_id";

    private final MongoTemplate mongoTemplate;

    public CustomKnowledgeBaseItemRepositoryImpl(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public List<KnowledgeBaseItem> findFoldersForParent(String parentId, String search, List<String> itemIds) {
        Query query = new Query();

        if (StringUtils.hasText(parentId)) {
            query.addCriteria(Criteria.where(FIELD_PARENT_ID).is(parentId));
        } else {
            query.addCriteria(Criteria.where(FIELD_PARENT_ID).isNull());
        }

        query.addCriteria(Criteria.where(FIELD_TYPE).is(KnowledgeBaseItemType.FOLDER));

        if (StringUtils.hasText(search)) {
            query.addCriteria(Criteria.where(FIELD_NAME).regex(search, "i"));
        }

        if (itemIds != null) {
            query.addCriteria(Criteria.where(ID_FIELD).in(itemIds));
        }

        query.with(Sort.by(
                Sort.Order.asc(FIELD_NAME),
                Sort.Order.desc(ID_FIELD)
        ));

        return mongoTemplate.find(query, KnowledgeBaseItem.class);
    }

    @Override
    public List<KnowledgeBaseItem> findArticles(String currentUserId, String parentId, String search,
                                                 KnowledgeBaseItemType type, List<String> itemIds,
                                                 String cursor, int limit) {
        Query query = buildItemQuery(currentUserId, parentId, search, type, itemIds);
        return findWithCursor(query, cursor, limit);
    }

    @Override
    public long countArticles(String currentUserId, String parentId, String search,
                              KnowledgeBaseItemType type, List<String> itemIds) {
        Query query = buildItemQuery(currentUserId, parentId, search, type, itemIds);
        return mongoTemplate.count(query, KnowledgeBaseItem.class);
    }

    @Override
    public List<KnowledgeBaseItem> findArchivedArticles(String currentUserId, String search, List<String> itemIds,
                                                         String cursor, int limit) {
        Query query = buildArchivedArticlesQuery(currentUserId, search, itemIds);
        return findWithCursor(query, cursor, limit);
    }

    @Override
    public long countArchivedArticles(String currentUserId, String search, List<String> itemIds) {
        Query query = buildArchivedArticlesQuery(currentUserId, search, itemIds);
        return mongoTemplate.count(query, KnowledgeBaseItem.class);
    }

    private Query buildItemQuery(String currentUserId, String parentId, String search,
                                  KnowledgeBaseItemType type, List<String> itemIds) {
        Query query = new Query();

        if (StringUtils.hasText(parentId)) {
            query.addCriteria(Criteria.where(FIELD_PARENT_ID).is(parentId));
        } else {
            query.addCriteria(Criteria.where(FIELD_PARENT_ID).isNull());
        }

        if (type != null) {
            query.addCriteria(Criteria.where(FIELD_TYPE).is(type));
        }

        if (StringUtils.hasText(search)) {
            query.addCriteria(new Criteria().orOperator(
                    Criteria.where(FIELD_NAME).regex(search, "i"),
                    Criteria.where(FIELD_SUMMARY).regex(search, "i")
            ));
        }

        if (itemIds != null) {
            query.addCriteria(Criteria.where(ID_FIELD).in(itemIds));
        }

        query.addCriteria(Criteria.where(FIELD_STATUS).ne(KnowledgeBaseArticleStatus.ARCHIVED));
        query.addCriteria(buildDraftVisibilityCriteria(currentUserId));

        return query;
    }

    private Query buildArchivedArticlesQuery(String currentUserId, String search, List<String> itemIds) {
        Query query = new Query();
        query.addCriteria(Criteria.where(FIELD_TYPE).is(KnowledgeBaseItemType.ARTICLE));
        query.addCriteria(Criteria.where(FIELD_STATUS).is(KnowledgeBaseArticleStatus.ARCHIVED));

        if (StringUtils.hasText(search)) {
            query.addCriteria(new Criteria().orOperator(
                    Criteria.where(FIELD_NAME).regex(search, "i"),
                    Criteria.where(FIELD_SUMMARY).regex(search, "i")
            ));
        }

        if (itemIds != null) {
            query.addCriteria(Criteria.where(ID_FIELD).in(itemIds));
        }

        query.addCriteria(buildDraftVisibilityCriteria(currentUserId));

        return query;
    }

    private Criteria buildDraftVisibilityCriteria(String currentUserId) {
        Criteria notDraft = Criteria.where(FIELD_STATUS).ne(KnowledgeBaseArticleStatus.DRAFT);
        Criteria ownDraft = Criteria.where(FIELD_CREATED_BY).is(currentUserId);
        return new Criteria().orOperator(notDraft, ownDraft);
    }

    private List<KnowledgeBaseItem> findWithCursor(Query query, String cursor, int limit) {
        if (StringUtils.hasText(cursor)) {
            try {
                ObjectId cursorId = new ObjectId(cursor);
                applyCursorCriteria(query, cursorId);
            } catch (IllegalArgumentException ex) {
                log.warn("Invalid ObjectId cursor format: {}", cursor);
            }
        }

        query.with(Sort.by(
                Sort.Order.desc(FIELD_UPDATED_AT),
                Sort.Order.desc(ID_FIELD)
        ));
        query.limit(limit);

        return mongoTemplate.find(query, KnowledgeBaseItem.class);
    }

    private void applyCursorCriteria(Query query, ObjectId cursorId) {
        KnowledgeBaseItem cursorDoc = mongoTemplate.findById(cursorId, KnowledgeBaseItem.class);
        if (cursorDoc == null) {
            log.warn("Cursor document not found for id: {}", cursorId);
            query.addCriteria(Criteria.where(ID_FIELD).lt(cursorId));
            return;
        }

        Object cursorSortValue = cursorDoc.getUpdatedAt();
        if (cursorSortValue == null) {
            query.addCriteria(Criteria.where(ID_FIELD).lt(cursorId));
            return;
        }

        Criteria pastSortValue = Criteria.where(FIELD_UPDATED_AT).lt(cursorSortValue);
        Criteria sameSortValuePastId = new Criteria().andOperator(
                Criteria.where(FIELD_UPDATED_AT).is(cursorSortValue),
                Criteria.where(ID_FIELD).lt(cursorId)
        );
        query.addCriteria(new Criteria().orOperator(pastSortValue, sameSortValuePastId));
    }
}
