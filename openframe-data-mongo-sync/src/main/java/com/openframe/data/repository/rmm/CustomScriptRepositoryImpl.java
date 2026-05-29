package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.Script;
import com.openframe.data.document.rmm.ScriptStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

import static org.apache.commons.lang3.StringUtils.isBlank;

/**
 * MongoTemplate-backed implementation of {@link CustomScriptRepository}.
 *
 * <p>Cursor pagination is implemented on {@code _id}: descending by default
 * ({@code newest first}), with the cursor comparison flipped when paginating
 * backward. The query is tenant-scoped, hitting the existing
 * {@code (tenantId, name)} compound index for the tenant prefix plus a natural
 * {@code _id} sort.
 *
 * <p>The cursor value is parsed into a Mongo {@link ObjectId} before being
 * applied to the query — comparing a String against a BSON {@code ObjectId}
 * field does not match correctly under Mongo's type-bracketing rules. An
 * invalid cursor (anything that is not a valid 24-char hex {@code ObjectId})
 * is logged and treated as "no cursor", returning the first page rather than
 * an opaque server error.
 */
@Slf4j
@Repository
@RequiredArgsConstructor
public class CustomScriptRepositoryImpl implements CustomScriptRepository {

    private static final String FIELD_ID = "_id";
    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_STATUS = "status";

    private final MongoTemplate mongoTemplate;

    @Override
    public List<Script> findPageForTenant(String tenantId, String cursor, boolean backward, int limit) {
        Criteria criteria = Criteria.where(FIELD_TENANT_ID).is(tenantId)
                .and(FIELD_STATUS).ne(ScriptStatus.DELETED);
        applyCursor(criteria, cursor, backward);

        Query query = new Query(criteria)
                .with(Sort.by(backward ? Sort.Direction.ASC : Sort.Direction.DESC, FIELD_ID))
                .limit(limit);

        return mongoTemplate.find(query, Script.class);
    }

    private static void applyCursor(Criteria criteria, String cursor, boolean backward) {
        if (isBlank(cursor)) {
            return;
        }

        ObjectId cursorId;
        try {
            cursorId = new ObjectId(cursor);
        } catch (IllegalArgumentException ex) {
            log.warn("Invalid ObjectId cursor for script pagination: '{}' — falling back to first page", cursor);
            return;
        }

        if (backward) {
            criteria.and(FIELD_ID).gt(cursorId);
        } else {
            criteria.and(FIELD_ID).lt(cursorId);
        }
    }
}
