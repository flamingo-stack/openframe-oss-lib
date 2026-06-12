package com.openframe.data.repository.notification.impl;

import com.openframe.data.document.notification.NotificationReadState;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.data.repository.TenantAwareRepositorySupport;
import com.openframe.data.repository.notification.CustomNotificationReadStateRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.mongodb.BulkOperationException;
import org.springframework.data.mongodb.core.BulkOperations;

import java.util.List;

@Slf4j
@ConditionalOnProperty(name = "openframe.tenant-isolation.enabled", havingValue = "true")
public class CustomNotificationReadStateRepositoryImpl extends TenantAwareRepositorySupport implements CustomNotificationReadStateRepository {

    private static final int MONGO_DUPLICATE_KEY = 11000;

    public CustomNotificationReadStateRepositoryImpl(TenantAwareMongoTemplate mongoTemplate) {
        super(mongoTemplate);
    }

    @Override
    public void bulkInsertUnordered(List<NotificationReadState> rows) {
        if (rows == null || rows.isEmpty()) {
            return;
        }
        try {
            mongoTemplate.bulkOps(BulkOperations.BulkMode.UNORDERED, NotificationReadState.class)
                    .insert(rows)
                    .execute();
        } catch (BulkOperationException ex) {
            if (!allDuplicateKeyErrors(ex)) {
                throw ex;
            }
            log.debug("bulkInsertUnordered swallowed {} duplicate-key errors", ex.getErrors().size());
        }
    }

    private static boolean allDuplicateKeyErrors(BulkOperationException ex) {
        if (ex.getErrors().isEmpty()) {
            return false;
        }
        return ex.getErrors().stream().allMatch(err -> err.getCode() == MONGO_DUPLICATE_KEY);
    }
}
