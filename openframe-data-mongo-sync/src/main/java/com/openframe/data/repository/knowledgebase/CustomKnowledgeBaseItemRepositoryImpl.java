package com.openframe.data.repository.knowledgebase;

import com.openframe.data.document.knowledgebase.KnowledgeBaseArticleStatus;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemType;
import lombok.extern.slf4j.Slf4j;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Collation;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Objects;
import java.util.regex.Pattern;
import java.util.stream.Stream;

@Slf4j
public class CustomKnowledgeBaseItemRepositoryImpl implements CustomKnowledgeBaseItemRepository {

    private static final String FIELD_TYPE = "type";
    private static final String FIELD_PARENT_ID = "parentId";
    private static final String FIELD_NAME = "name";
    private static final String FIELD_SUMMARY = "summary";
    private static final String FIELD_STATUS = "status";
    private static final String FIELD_UPDATED_AT = "updatedAt";
    private static final String ID_FIELD = "_id";

    /**
     * The order folders are listed in: case-insensitive, and digits by their value, so "apple"
     * sorts before "Zebra" and "Folder 2" before "Folder 10". Mongo's default comparison is by
     * code point and gets both wrong. The keyset comparison runs under the same collation as the
     * sort, and so must the indexes that serve it — see MongoIndexConfig.
     */
    public static final Collation FOLDER_NAME_COLLATION = Collation.of("en").strength(2).numericOrdering(true);

    private final MongoTemplate mongoTemplate;

    public CustomKnowledgeBaseItemRepositoryImpl(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public List<KnowledgeBaseItem> findFolders(KnowledgeBaseParentFilter parent, String search, List<String> itemIds,
                                               KnowledgeBaseItemCursor cursor, int limit) {
        Query query = buildFolderQuery(parent, search, itemIds);
        addComposites(query, folderPosition(cursor));
        query.with(Sort.by(
                Sort.Order.asc(FIELD_NAME),
                Sort.Order.desc(ID_FIELD)
        ));
        query.collation(FOLDER_NAME_COLLATION);
        query.limit(limit);
        return mongoTemplate.find(query, KnowledgeBaseItem.class);
    }

    @Override
    public long countFolders(KnowledgeBaseParentFilter parent, String search, List<String> itemIds) {
        return mongoTemplate.count(buildFolderQuery(parent, search, itemIds), KnowledgeBaseItem.class);
    }

    @Override
    public List<KnowledgeBaseItem> findArticles(KnowledgeBaseParentFilter parent, String search, List<String> itemIds,
                                                 List<KnowledgeBaseArticleStatus> statuses,
                                                 KnowledgeBaseItemCursor cursor, int limit) {
        Query query = buildArticleQuery(parent, itemIds, statuses);
        addComposites(query, articleSearch(search), articlePosition(cursor));
        return executeWithArticleSort(query, limit);
    }

    @Override
    public long countArticles(KnowledgeBaseParentFilter parent, String search, List<String> itemIds,
                              List<KnowledgeBaseArticleStatus> statuses) {
        Query query = buildArticleQuery(parent, itemIds, statuses);
        addComposites(query, articleSearch(search));
        return mongoTemplate.count(query, KnowledgeBaseItem.class);
    }

    @Override
    public List<KnowledgeBaseItem> findFolderLinks() {
        Query query = new Query(Criteria.where(FIELD_TYPE).is(KnowledgeBaseItemType.FOLDER));
        query.fields().include(FIELD_PARENT_ID);
        return mongoTemplate.find(query, KnowledgeBaseItem.class);
    }

    @Override
    public List<KnowledgeBaseItem> findArchivedArticles(String search, List<String> itemIds,
                                                         KnowledgeBaseItemCursor cursor, int limit) {
        Query query = buildArchivedArticlesQuery(itemIds);
        addComposites(query, articleSearch(search), articlePosition(cursor));
        return executeWithArticleSort(query, limit);
    }

    @Override
    public long countArchivedArticles(String search, List<String> itemIds) {
        Query query = buildArchivedArticlesQuery(itemIds);
        addComposites(query, articleSearch(search));
        return mongoTemplate.count(query, KnowledgeBaseItem.class);
    }

    @Override
    public List<KnowledgeBaseItem> findAllArticles() {
        Query query = new Query();
        query.addCriteria(Criteria.where(FIELD_TYPE).is(KnowledgeBaseItemType.ARTICLE));
        query.addCriteria(Criteria.where(FIELD_STATUS).ne(KnowledgeBaseArticleStatus.ARCHIVED));
        query.with(Sort.by(Sort.Order.asc(FIELD_NAME), Sort.Order.desc(ID_FIELD)));
        return mongoTemplate.find(query, KnowledgeBaseItem.class);
    }

    private Query buildFolderQuery(KnowledgeBaseParentFilter parent, String search, List<String> itemIds) {
        Query query = new Query();
        addParentCriteria(query, parent);
        query.addCriteria(Criteria.where(FIELD_TYPE).is(KnowledgeBaseItemType.FOLDER));

        if (StringUtils.hasText(search)) {
            query.addCriteria(Criteria.where(FIELD_NAME).regex(Pattern.quote(search), "i"));
        }

        if (itemIds != null) {
            query.addCriteria(Criteria.where(ID_FIELD).in(itemIds));
        }
        return query;
    }

    /** Drafts are visible to all admins (team collaboration model); only archived articles are held back. */
    private Query buildArticleQuery(KnowledgeBaseParentFilter parent, List<String> itemIds,
                                    List<KnowledgeBaseArticleStatus> statuses) {
        Query query = new Query();
        addParentCriteria(query, parent);
        query.addCriteria(Criteria.where(FIELD_TYPE).is(KnowledgeBaseItemType.ARTICLE));

        if (itemIds != null) {
            query.addCriteria(Criteria.where(ID_FIELD).in(itemIds));
        }

        if (statuses != null && !statuses.isEmpty()) {
            query.addCriteria(Criteria.where(FIELD_STATUS).in(statuses));
        } else {
            query.addCriteria(Criteria.where(FIELD_STATUS).ne(KnowledgeBaseArticleStatus.ARCHIVED));
        }
        return query;
    }

    private Query buildArchivedArticlesQuery(List<String> itemIds) {
        Query query = new Query();
        query.addCriteria(Criteria.where(FIELD_TYPE).is(KnowledgeBaseItemType.ARTICLE));
        query.addCriteria(Criteria.where(FIELD_STATUS).is(KnowledgeBaseArticleStatus.ARCHIVED));

        if (itemIds != null) {
            query.addCriteria(Criteria.where(ID_FIELD).in(itemIds));
        }
        return query;
    }

    private static void addParentCriteria(Query query, KnowledgeBaseParentFilter parent) {
        if (parent.unrestricted()) {
            return;
        }
        List<String> parentIds = parent.parentIds();
        if (parentIds.isEmpty()) {
            query.addCriteria(Criteria.where(FIELD_PARENT_ID).isNull());
        } else if (parentIds.size() == 1) {
            query.addCriteria(Criteria.where(FIELD_PARENT_ID).is(parentIds.getFirst()));
        } else {
            query.addCriteria(Criteria.where(FIELD_PARENT_ID).in(parentIds));
        }
    }

    private static Criteria articleSearch(String search) {
        if (!StringUtils.hasText(search)) {
            return null;
        }
        String quoted = Pattern.quote(search);
        return new Criteria().orOperator(
                Criteria.where(FIELD_NAME).regex(quoted, "i"),
                Criteria.where(FIELD_SUMMARY).regex(quoted, "i"));
    }

    /**
     * Folders after the cursor in (name asc, _id desc) order. "After" and "same name" are decided by
     * the query's collation, so names that differ only in case tie and fall back to the id.
     *
     * Every branch returns an operator criteria (a null key), never a bare field one: the folder
     * query already holds criteria on name (the search) and may hold one on _id (the tag filter),
     * and Spring Data Mongo rejects a second criteria on the same key.
     */
    private static Criteria folderPosition(KnowledgeBaseItemCursor cursor) {
        if (cursor == null || cursor.name() == null) {
            return null;
        }
        Criteria pastName = Criteria.where(FIELD_NAME).gt(cursor.name());
        ObjectId cursorId = toObjectId(cursor.id());
        if (cursorId == null) {
            return new Criteria().orOperator(pastName);
        }
        Criteria sameNamePastId = new Criteria().andOperator(
                Criteria.where(FIELD_NAME).is(cursor.name()),
                Criteria.where(ID_FIELD).lt(cursorId)
        );
        return new Criteria().orOperator(pastName, sameNamePastId);
    }

    /**
     * Articles after the cursor in (updatedAt desc, _id desc) order. A cursor without a sort value
     * (a document that has none, or a legacy cursor whose document is gone) falls back to the id
     * alone. Operator criteria throughout, for the reason given on {@link #folderPosition}.
     */
    private static Criteria articlePosition(KnowledgeBaseItemCursor cursor) {
        if (cursor == null) {
            return null;
        }
        ObjectId cursorId = toObjectId(cursor.id());
        if (cursor.updatedAt() == null) {
            if (cursorId == null) {
                log.warn("Knowledge base cursor carries neither a sort value nor a valid id: {}", cursor.id());
                return null;
            }
            return new Criteria().andOperator(Criteria.where(ID_FIELD).lt(cursorId));
        }

        Criteria pastSortValue = Criteria.where(FIELD_UPDATED_AT).lt(cursor.updatedAt());
        if (cursorId == null) {
            return new Criteria().orOperator(pastSortValue);
        }
        Criteria sameSortValuePastId = new Criteria().andOperator(
                Criteria.where(FIELD_UPDATED_AT).is(cursor.updatedAt()),
                Criteria.where(ID_FIELD).lt(cursorId)
        );
        return new Criteria().orOperator(pastSortValue, sameSortValuePastId);
    }

    private static ObjectId toObjectId(String id) {
        return id != null && ObjectId.isValid(id) ? new ObjectId(id) : null;
    }

    /**
     * Combines the operator criteria of one query (search $or, cursor $or) into a single $and at
     * root. Spring Data Mongo rejects multiple $or criteria on the same Query (null-key collision).
     */
    private static void addComposites(Query query, Criteria... composites) {
        List<Criteria> present = Stream.of(composites).filter(Objects::nonNull).toList();

        if (present.size() == 1) {
            query.addCriteria(present.getFirst());
        } else if (!present.isEmpty()) {
            query.addCriteria(new Criteria().andOperator(present.toArray(new Criteria[0])));
        }
    }

    private List<KnowledgeBaseItem> executeWithArticleSort(Query query, int limit) {
        query.with(Sort.by(
                Sort.Order.desc(FIELD_UPDATED_AT),
                Sort.Order.desc(ID_FIELD)
        ));
        query.limit(limit);
        return mongoTemplate.find(query, KnowledgeBaseItem.class);
    }
}
