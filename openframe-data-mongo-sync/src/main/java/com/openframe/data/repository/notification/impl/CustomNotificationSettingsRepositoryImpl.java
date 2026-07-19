package com.openframe.data.repository.notification.impl;

import com.openframe.data.document.notification.NotificationSettings;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.data.repository.TenantAwareRepositorySupport;
import com.openframe.data.repository.notification.CustomNotificationSettingsRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.Instant;

/**
 * Writes use {@code upsert}: atomic insert-or-update on the {tenantId, userId} unique index. tenantId
 * lands via the scoped filter; TenantStampingCallback covers only entity writes, not Update-based ones.
 */
@Slf4j
@ConditionalOnProperty(name = "openframe.tenant-isolation.enabled", havingValue = "true")
public class CustomNotificationSettingsRepositoryImpl extends TenantAwareRepositorySupport
        implements CustomNotificationSettingsRepository {

    private static final String FIELD_USER_ID = "userId";
    private static final String FIELD_PUSH_ENABLED = "pushEnabled";
    private static final String FIELD_CREATED_AT = "createdAt";
    private static final String FIELD_UPDATED_AT = "updatedAt";

    public CustomNotificationSettingsRepositoryImpl(TenantAwareMongoTemplate mongoTemplate) {
        super(mongoTemplate);
    }

    @Override
    public void setPushEnabled(String userId, boolean enabled) {
        Query byUser = new Query(Criteria.where(FIELD_USER_ID).is(userId));
        Instant now = Instant.now();
        Update update = new Update()
                .set(FIELD_PUSH_ENABLED, enabled)
                .set(FIELD_UPDATED_AT, now)
                .setOnInsert(FIELD_CREATED_AT, now);
        try {
            mongoTemplate.upsert(byUser, update, NotificationSettings.class);
        } catch (DuplicateKeyException ex) {
            // Lost an insert race on the unique index; the row exists now, so a plain update settles it.
            mongoTemplate.updateFirst(byUser, update, NotificationSettings.class);
        }
        log.debug("Push {} for user {}", enabled ? "enabled" : "disabled", userId);
    }
}
