package com.openframe.data.repository.notification.impl;

import com.openframe.data.document.notification.NotificationContentPolicy;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.data.repository.TenantAwareRepositorySupport;
import com.openframe.data.repository.notification.CustomNotificationContentPolicyRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.Instant;
import java.util.Optional;

@Slf4j
@ConditionalOnProperty(name = "openframe.tenant-isolation.enabled", havingValue = "true")
public class CustomNotificationContentPolicyRepositoryImpl extends TenantAwareRepositorySupport
        implements CustomNotificationContentPolicyRepository {

    private static final String FIELD_CONTENT_SUPPRESSED = "contentSuppressed";
    private static final String FIELD_CREATED_AT = "createdAt";
    private static final String FIELD_UPDATED_AT = "updatedAt";

    public CustomNotificationContentPolicyRepositoryImpl(TenantAwareMongoTemplate mongoTemplate) {
        super(mongoTemplate);
    }

    @Override
    public Optional<NotificationContentPolicy> find() {
        return Optional.ofNullable(mongoTemplate.findOne(new Query(), NotificationContentPolicy.class));
    }

    @Override
    public void setContentSuppressed(boolean suppressed) {
        Query forTenant = new Query();
        Instant now = Instant.now();
        Update update = new Update()
                .set(FIELD_CONTENT_SUPPRESSED, suppressed)
                .set(FIELD_UPDATED_AT, now)
                .setOnInsert(FIELD_CREATED_AT, now);
        try {
            mongoTemplate.upsert(forTenant, update, NotificationContentPolicy.class);
        } catch (DuplicateKeyException ex) {
            // Lost an insert race on the unique index; the row exists now, so a plain update settles it.
            mongoTemplate.updateFirst(forTenant, update, NotificationContentPolicy.class);
        }
        log.debug("Notification content suppression {} for tenant {}", suppressed ? "enabled" : "disabled", tenantId());
    }
}
