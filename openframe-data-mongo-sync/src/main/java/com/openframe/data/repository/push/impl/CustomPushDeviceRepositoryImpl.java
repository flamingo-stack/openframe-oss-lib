package com.openframe.data.repository.push.impl;

import com.mongodb.client.result.DeleteResult;
import com.mongodb.client.result.UpdateResult;
import com.openframe.data.document.push.PushDevice;
import com.openframe.data.document.push.PushPlatform;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.data.repository.TenantAwareRepositorySupport;
import com.openframe.data.repository.push.CustomPushDeviceRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.Instant;
import java.util.Collection;

/**
 * Writes use {@code upsert}, not {@code save}: registration must atomically insert-or-rebind on the
 * {tenantId, token} unique index — save() is a racy read-modify-write. tenantId lands via the scoped
 * filter; TenantStampingCallback covers only entity writes, not Update-based ones.
 */
@Slf4j
@ConditionalOnProperty(name = "openframe.tenant-isolation.enabled", havingValue = "true")
public class CustomPushDeviceRepositoryImpl extends TenantAwareRepositorySupport implements CustomPushDeviceRepository {

    private static final String FIELD_TOKEN = "token";
    private static final String FIELD_USER_ID = "userId";
    private static final String FIELD_PLATFORM = "platform";
    private static final String FIELD_CREATED_AT = "createdAt";
    private static final String FIELD_UPDATED_AT = "updatedAt";

    public CustomPushDeviceRepositoryImpl(TenantAwareMongoTemplate mongoTemplate) {
        super(mongoTemplate);
    }

    @Override
    public boolean registerToken(String userId, String token, PushPlatform platform) {
        Query byToken = new Query(Criteria.where(FIELD_TOKEN).is(token));
        Instant now = Instant.now();

        try {
            UpdateResult result = mongoTemplate.upsert(byToken,
                    getUpdateQuery(userId, platform, now).setOnInsert(FIELD_CREATED_AT, now),
                    PushDevice.class);
            boolean created = result.getUpsertedId() != null;
            log.debug("Push token {} for user {}", created ? "registered" : "re-associated", userId);
            return created;
        } catch (DuplicateKeyException ex) {
            // Upsert is not atomic against the unique index; a concurrent register won the insert.
            // Retrying the upsert would race again — its row exists now, so a plain update settles it.
            UpdateResult result = mongoTemplate.updateFirst(byToken, getUpdateQuery(userId, platform, now),
                    PushDevice.class);
            if (result.getMatchedCount() > 0) {
                log.debug("Push token re-associated to user {} after losing an insert race", userId);
                return false;
            }
            return mongoTemplate.upsert(byToken,
                    getUpdateQuery(userId, platform, now).setOnInsert(FIELD_CREATED_AT, now),
                    PushDevice.class).getUpsertedId() != null;
        }
    }

    @Override
    public boolean removeToken(String userId, String token) {
        DeleteResult result = mongoTemplate.remove(
                new Query(Criteria.where(FIELD_USER_ID).is(userId).and(FIELD_TOKEN).is(token)), PushDevice.class);
        return result.getDeletedCount() > 0;
    }

    @Override
    public long removeTokens(Collection<String> tokens) {
        if (tokens == null || tokens.isEmpty()) {
            return 0;
        }
        DeleteResult result = mongoTemplate.remove(
                new Query(Criteria.where(FIELD_TOKEN).in(tokens)), PushDevice.class);
        return result.getDeletedCount();
    }

    private Update getUpdateQuery(String userId, PushPlatform platform, Instant now) {
        return new Update()
                .set(FIELD_USER_ID, userId)
                .set(FIELD_PLATFORM, platform)
                .set(FIELD_UPDATED_AT, now);
    }
}
