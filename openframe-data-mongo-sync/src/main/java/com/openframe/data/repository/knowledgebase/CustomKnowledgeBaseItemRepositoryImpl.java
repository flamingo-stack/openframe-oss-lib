package com.openframe.data.repository.knowledgebase;

import com.openframe.core.exception.InvalidCursorException;
import com.openframe.data.document.knowledgebase.KnowledgeBaseArticleStatus;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemType;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Collation;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.regex.Pattern;
import java.util.stream.Stream;

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
                                               KnowledgeBaseItemCursor cursor, boolean backward, int limit) {
        Query query = buildFolderQuery(parent, search, itemIds);
        addComposites(query, folderPosition(cursor, backward));
        query.with(folderSort(backward));
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
                                                 KnowledgeBaseItemCursor cursor, boolean backward, int limit) {
        Query query = buildArticleQuery(parent, itemIds, statuses);
        addComposites(query, articleSearch(search), articlePosition(cursor, backward));
        return executeWithArticleSort(query, backward, limit);
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
                                                         KnowledgeBaseItemCursor cursor, boolean backward, int limit) {
        Query query = buildArchivedArticlesQuery(itemIds);
        addComposites(query, articleSearch(search), articlePosition(cursor, backward));
        return executeWithArticleSort(query, backward, limit);
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

    @Override
    public Optional<KnowledgeBaseItem> findCursorItem(String id) {
        ObjectId itemId = toObjectId(id);
        if (itemId == null) {
            return Optional.empty();
        }
        Criteria byId = Criteria.where(ID_FIELD).is(itemId);
        Query query = new Query(byId);
        KnowledgeBaseItem item = mongoTemplate.findOne(query, KnowledgeBaseItem.class);
        return Optional.ofNullable(item);
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

    private static Sort folderSort(boolean backward) {
        return backward
                ? Sort.by(Sort.Order.desc(FIELD_NAME), Sort.Order.asc(ID_FIELD))
                : Sort.by(Sort.Order.asc(FIELD_NAME), Sort.Order.desc(ID_FIELD));
    }

    /**
     * Folders past the cursor: after it in (name asc, _id desc) order, or before it when paging
     * backward. "Past" and "same name" are decided by the query's collation, so names that differ
     * only in case tie and fall back to the id.
     *
     * Every branch returns an operator criteria (a null key), never a bare field one: the folder
     * query already holds criteria on name (the search) and may hold one on _id (the tag filter),
     * and Spring Data Mongo rejects a second criteria on the same key.
     */
    private static Criteria folderPosition(KnowledgeBaseItemCursor cursor, boolean backward) {
        if (cursor == null || cursor.name() == null) {
            return null;
        }
        Criteria name = Criteria.where(FIELD_NAME);
        Criteria pastName = backward ? name.lt(cursor.name()) : name.gt(cursor.name());
        ObjectId cursorId = toObjectId(cursor.id());
        if (cursorId == null) {
            return new Criteria().orOperator(pastName);
        }
        Criteria sameName = Criteria.where(FIELD_NAME).is(cursor.name());
        Criteria pastId = pastId(cursorId, backward);
        Criteria sameNamePastId = new Criteria().andOperator(sameName, pastId);
        return new Criteria().orOperator(pastName, sameNamePastId);
    }

    /**
     * Articles past the cursor: after it in (updatedAt desc, _id desc) order, or before it when
     * paging backward. A cursor of a document without a sort value falls back to the id alone.
     * Operator criteria throughout, for the reason given on {@link #folderPosition}.
     */
    private static Criteria articlePosition(KnowledgeBaseItemCursor cursor, boolean backward) {
        if (cursor == null) {
            return null;
        }
        ObjectId cursorId = toObjectId(cursor.id());
        if (cursor.updatedAt() == null) {
            if (cursorId == null) {
                throw new InvalidCursorException();
            }
            Criteria pastId = pastId(cursorId, backward);
            return new Criteria().andOperator(pastId);
        }

        Criteria updatedAt = Criteria.where(FIELD_UPDATED_AT);
        Criteria pastSortValue = backward ? updatedAt.gt(cursor.updatedAt()) : updatedAt.lt(cursor.updatedAt());
        if (cursorId == null) {
            return new Criteria().orOperator(pastSortValue);
        }
        Criteria sameSortValue = Criteria.where(FIELD_UPDATED_AT).is(cursor.updatedAt());
        Criteria pastId = pastId(cursorId, backward);
        Criteria sameSortValuePastId = new Criteria().andOperator(sameSortValue, pastId);
        return new Criteria().orOperator(pastSortValue, sameSortValuePastId);
    }

    private static Criteria pastId(ObjectId cursorId, boolean backward) {
        Criteria id = Criteria.where(ID_FIELD);
        return backward ? id.gt(cursorId) : id.lt(cursorId);
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

    private List<KnowledgeBaseItem> executeWithArticleSort(Query query, boolean backward, int limit) {
        Sort.Direction fetchDirection = backward ? Sort.Direction.ASC : Sort.Direction.DESC;
        query.with(Sort.by(fetchDirection, FIELD_UPDATED_AT, ID_FIELD));
        query.limit(limit);
        return mongoTemplate.find(query, KnowledgeBaseItem.class);
    }
}
