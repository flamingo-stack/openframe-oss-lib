package com.openframe.data.repository.rmm.osupdate;

import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateClassification;
import lombok.RequiredArgsConstructor;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

import static org.apache.commons.lang3.StringUtils.isNotBlank;

@Repository
@RequiredArgsConstructor
public class CustomOsUpdateRepositoryImpl implements CustomOsUpdateRepository {

    private static final String FIELD_ID = "_id";
    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_PLATFORM = "platform";
    private static final String FIELD_CLASSIFICATION = "classification";
    private static final String FIELD_DISPLAY_NAME = "displayName";
    private static final String FIELD_KB_ARTICLE_IDS = "kbArticleIds";
    private static final String FIELD_CVE_IDS = "cveIds";
    private static final String FIELD_FIRST_SEEN_AT = "firstSeenAt";
    private static final Sort NEWEST_SEEN_FIRST = Sort.by(Sort.Direction.DESC, FIELD_FIRST_SEEN_AT, FIELD_ID);

    private final MongoTemplate mongoTemplate;

    @Override
    public List<OsUpdate> findPage(String tenantId, OsUpdateFilter filter, String cursor, int limit) {
        Criteria ofTenant = Criteria.where(FIELD_TENANT_ID).is(tenantId);
        List<Criteria> conditions = new ArrayList<>();
        conditions.add(ofTenant);
        OsPlatform platform = filter.getPlatform();
        if (platform != null) {
            Criteria ofPlatform = Criteria.where(FIELD_PLATFORM).is(platform);
            conditions.add(ofPlatform);
        }
        List<OsUpdateClassification> classifications = filter.getClassifications();
        if (classifications != null && !classifications.isEmpty()) {
            Criteria ofClassifications = Criteria.where(FIELD_CLASSIFICATION).in(classifications);
            conditions.add(ofClassifications);
        }
        String search = filter.getSearch();
        if (isNotBlank(search)) {
            Criteria matchingSearch = matchingSearch(search);
            conditions.add(matchingSearch);
        }
        if (isNotBlank(cursor)) {
            Criteria afterCursor = after(cursor);
            conditions.add(afterCursor);
        }
        Criteria page = new Criteria().andOperator(conditions);
        Query query = Query.query(page).with(NEWEST_SEEN_FIRST).limit(limit);
        return mongoTemplate.find(query, OsUpdate.class);
    }

    @Override
    public String encodeCursor(OsUpdate osUpdate) {
        Instant firstSeenAt = osUpdate.getFirstSeenAt();
        String id = osUpdate.getId();
        return OsUpdateKeysetCursor.encode(firstSeenAt, id);
    }

    // The search text is matched as it is typed, never as a pattern.
    private static Criteria matchingSearch(String search) {
        String quotedSearch = Pattern.quote(search.trim());
        Pattern containsSearch = Pattern.compile(quotedSearch, Pattern.CASE_INSENSITIVE);
        Criteria inDisplayName = Criteria.where(FIELD_DISPLAY_NAME).regex(containsSearch);
        Criteria inKbArticleIds = Criteria.where(FIELD_KB_ARTICLE_IDS).regex(containsSearch);
        Criteria inCveIds = Criteria.where(FIELD_CVE_IDS).regex(containsSearch);
        return new Criteria().orOperator(inDisplayName, inKbArticleIds, inCveIds);
    }

    private static Criteria after(String cursor) {
        OsUpdateKeysetCursor keysetCursor = OsUpdateKeysetCursor.parse(cursor);
        Instant firstSeenAt = keysetCursor.getInstant();
        ObjectId id = parseId(keysetCursor.getKey());
        Criteria seenEarlier = Criteria.where(FIELD_FIRST_SEEN_AT).lt(firstSeenAt);
        Criteria seenTogetherOlderId = Criteria.where(FIELD_FIRST_SEEN_AT).is(firstSeenAt).and(FIELD_ID).lt(id);
        return new Criteria().orOperator(seenEarlier, seenTogetherOlderId);
    }

    private static ObjectId parseId(String hex) {
        try {
            return new ObjectId(hex);
        } catch (IllegalArgumentException invalid) {
            throw new BadRequestException("Invalid ObjectId in OS update cursor: " + hex);
        }
    }
}
