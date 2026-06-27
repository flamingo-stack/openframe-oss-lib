package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.Script;
import com.openframe.data.document.rmm.filter.ScriptQueryFilter;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

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
    private static final String FIELD_NAME = "name";
    private static final String FIELD_SHELL = "shell";
    private static final String FIELD_SUPPORTED_PLATFORMS = "supportedPlatforms";
    private static final String FIELD_CREATED_AT = "createdAt";
    private static final String FIELD_UPDATED_AT = "updatedAt";
    private static final String FIELD_CREATED_BY = "createdBy";

    // tag_assignments fields used to resolve the tagIds filter into script ids.
    private static final String FIELD_TA_TAG_ID = "tagId";
    private static final String FIELD_TA_ENTITY_ID = "entityId";
    private static final String FIELD_TA_ENTITY_TYPE = "entityType";

    /** Sort-field allowlist. Anything not in here falls back to {@link #getDefaultSortField()}. */
    private static final Set<String> SORTABLE_FIELDS =
            Set.of(FIELD_ID, FIELD_NAME, FIELD_CREATED_AT, FIELD_UPDATED_AT);

    private final MongoTemplate mongoTemplate;

    @Override
    public List<Script> findPageForTenant(String tenantId,
                                          ScriptQueryFilter filter,
                                          String search,
                                          String sortField,
                                          Sort.Direction sortDirection,
                                          String cursor,
                                          boolean backward,
                                          int limit) {
        Criteria criteria = buildBaseCriteria(tenantId, filter, search);
        applyCursor(criteria, cursor, backward, sortDirection);

        Sort.Direction effectiveDir = backward ? flip(sortDirection) : sortDirection;
        Query query = new Query(criteria)
                .with(Sort.by(effectiveDir, sortField))
                .limit(limit);

        return mongoTemplate.find(query, Script.class);
    }

    @Override
    public long countForTenant(String tenantId, ScriptQueryFilter filter, String search) {
        // Same predicate as a page fetch but WITHOUT cursor/limit/sort — the
        // full matching count for the tenant.
        Query query = new Query(buildBaseCriteria(tenantId, filter, search));
        return mongoTemplate.count(query, Script.class);
    }

    /**
     * Build the shared tenant + filter + search predicate (no cursor, no sort,
     * no limit) used by both the page fetch and the count.
     */
    private Criteria buildBaseCriteria(String tenantId, ScriptQueryFilter filter, String search) {
        Criteria criteria = Criteria.where(FIELD_TENANT_ID).is(tenantId);
        applyStatusFilter(criteria, filter);
        applyShellsFilter(criteria, filter);
        applyPlatformsFilter(criteria, filter);
        applyTagIdsFilter(criteria, filter);
        applyCreatedByFilter(criteria, filter);
        applySearch(criteria, search);
        return criteria;
    }

    @Override
    public boolean isSortableField(String field) {
        return field != null && SORTABLE_FIELDS.contains(field);
    }

    @Override
    public String getDefaultSortField() {
        return FIELD_ID;
    }

    private static void applyStatusFilter(Criteria criteria, ScriptQueryFilter filter) {
        if (filter != null && filter.getStatuses() != null && !filter.getStatuses().isEmpty()) {
            // Explicit caller request — respect it verbatim (admin audit may ask for [DELETED]).
            criteria.and(FIELD_STATUS).in(filter.getStatuses());
        } else {
            // Default: hide soft-deleted scripts. {@code $ne} also covers legacy
            // documents that have no status field at all.
            criteria.and(FIELD_STATUS).ne(ScriptStatus.DELETED);
        }
    }

    private static void applyShellsFilter(Criteria criteria, ScriptQueryFilter filter) {
        if (filter != null && filter.getShells() != null && !filter.getShells().isEmpty()) {
            criteria.and(FIELD_SHELL).in(filter.getShells());
        }
    }

    private static void applyPlatformsFilter(Criteria criteria, ScriptQueryFilter filter) {
        if (filter != null && filter.getSupportedPlatforms() != null && !filter.getSupportedPlatforms().isEmpty()) {
            // Match scripts whose supportedPlatforms array contains ANY of the requested platforms.
            criteria.and(FIELD_SUPPORTED_PLATFORMS).in(filter.getSupportedPlatforms());
        }
    }

    private static void applyCreatedByFilter(Criteria criteria, ScriptQueryFilter filter) {
        if (filter != null && filter.getCreatedByIds() != null && !filter.getCreatedByIds().isEmpty()) {
            // Match scripts created by ANY of the given users (raw createdBy ids).
            criteria.and(FIELD_CREATED_BY).in(filter.getCreatedByIds());
        }
    }

    /**
     * Restrict to scripts assigned ANY of the filter's {@code tagIds}, resolved
     * via the {@code tag_assignments} collection (entity type {@code SCRIPT}).
     * Done here (not in the service) so the data-layer filter speaks tags
     * end-to-end. {@code null} tagIds = no constraint; if no script is assigned
     * any of the tags, an empty {@code _id IN []} matches nothing.
     */
    private void applyTagIdsFilter(Criteria criteria, ScriptQueryFilter filter) {
        if (filter == null || filter.getTagIds() == null) {
            return;
        }
        Query taQuery = new Query(Criteria.where(FIELD_TA_TAG_ID).in(filter.getTagIds())
                .and(FIELD_TA_ENTITY_TYPE).is(TagEntityType.SCRIPT));
        taQuery.fields().include(FIELD_TA_ENTITY_ID);

        List<ObjectId> scriptObjectIds = mongoTemplate.find(taQuery, TagAssignment.class).stream()
                .map(TagAssignment::getEntityId)
                .filter(id -> id != null && ObjectId.isValid(id))
                .distinct()
                .map(ObjectId::new)
                .toList();
        criteria.and(FIELD_ID).in(scriptObjectIds);
    }

    private static void applySearch(Criteria criteria, String search) {
        if (isBlank(search)) {
            return;
        }

        // Case-insensitive substring match on script name. Pattern.quote escapes
        // any regex metacharacters the user may have typed.
        criteria.and(FIELD_NAME).regex(Pattern.quote(search.trim()), "i");
    }

    private static void applyCursor(Criteria criteria, String cursor, boolean backward, Sort.Direction sortDirection) {
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

        // The comparison direction depends on BOTH the sort direction and the
        // pagination direction: forward+DESC and backward+ASC both want
        // {@code _id < cursor}; forward+ASC and backward+DESC want {@code _id > cursor}.
        boolean useLessThan = (sortDirection == Sort.Direction.DESC) ^ backward;
        if (useLessThan) {
            criteria.and(FIELD_ID).lt(cursorId);
        } else {
            criteria.and(FIELD_ID).gt(cursorId);
        }
    }

    private static Sort.Direction flip(Sort.Direction direction) {
        return direction == Sort.Direction.ASC ? Sort.Direction.DESC : Sort.Direction.ASC;
    }
}
