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
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

/**
 * Every operation goes through {@link TenantAwareMongoTemplate}, which injects the tenant into the
 * query. Nothing in the platform populates {@code tenantId} on insert, so we rely on the upsert
 * contract instead: MongoDB builds an upserted document from the query's equality conditions plus
 * the update operators, so the row is created with exactly the {@code tenantId} the reads filter by.
 * Document and filter therefore cannot drift apart.
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
        Instant now = Instant.now();
        Query query = new Query(Criteria.where(FIELD_TOKEN).is(token));
        Update update = new Update()
                .set(FIELD_USER_ID, userId)
                .set(FIELD_PLATFORM, platform)
                .set(FIELD_UPDATED_AT, now)
                .setOnInsert(FIELD_CREATED_AT, now);

        UpdateResult result = mongoTemplate.upsert(query, update, PushDevice.class);
        boolean created = result.getUpsertedId() != null;
        log.debug("Push token {} for user {} ({})", created ? "registered" : "re-associated", userId, platform);
        return created;
    }

    @Override
    public List<PushDevice> findByUserId(String userId) {
        return mongoTemplate.find(new Query(Criteria.where(FIELD_USER_ID).is(userId)), PushDevice.class);
    }

    @Override
    public boolean removeToken(String token) {
        DeleteResult result = mongoTemplate.remove(
                new Query(Criteria.where(FIELD_TOKEN).is(token)), PushDevice.class);
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
}
