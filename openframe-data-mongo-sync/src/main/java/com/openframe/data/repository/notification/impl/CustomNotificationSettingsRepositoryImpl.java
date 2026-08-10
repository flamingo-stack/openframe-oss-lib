package com.openframe.data.repository.notification.impl;

import com.openframe.data.document.notification.NotificationSettingGroup;
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
import java.util.Map;

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
    private static final String FIELD_ENABLED = "enabled";
    private static final String FIELD_TYPE_SETTINGS = "typeSettings";
    private static final String FIELD_CREATED_AT = "createdAt";
    private static final String FIELD_UPDATED_AT = "updatedAt";

    public CustomNotificationSettingsRepositoryImpl(TenantAwareMongoTemplate mongoTemplate) {
        super(mongoTemplate);
    }

    @Override
    public void saveSettings(String userId, boolean enabled, Map<NotificationSettingGroup, Boolean> typeSettings) {
        Query byUser = new Query(Criteria.where(FIELD_USER_ID).is(userId));
        Instant now = Instant.now();
        Update update = new Update()
                .set(FIELD_ENABLED, enabled)
                .set(FIELD_PUSH_ENABLED, enabled)
                .set(FIELD_UPDATED_AT, now)
                .setOnInsert(FIELD_CREATED_AT, now);
        if (typeSettings != null) {
            // Null means "not sent" (a legacy master-only write) — existing group overrides survive.
            update.set(FIELD_TYPE_SETTINGS, typeSettings);
        }
        try {
            mongoTemplate.upsert(byUser, update, NotificationSettings.class);
        } catch (DuplicateKeyException ex) {
            // Lost an insert race on the unique index; the row exists now, so a plain update settles it.
            mongoTemplate.updateFirst(byUser, update, NotificationSettings.class);
        }
        log.debug("Notification settings saved for user {} (enabled={}, {} group override(s))",
                userId, enabled, typeSettings == null ? 0 : typeSettings.size());
    }
}
