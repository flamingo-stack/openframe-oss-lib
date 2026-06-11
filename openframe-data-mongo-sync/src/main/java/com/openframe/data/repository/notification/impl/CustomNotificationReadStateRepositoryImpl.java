package com.openframe.data.repository.notification.impl;

import com.openframe.data.document.notification.NotificationReadState;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.data.repository.notification.CustomNotificationReadStateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.BulkOperationException;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;

@Slf4j
@Repository
@RequiredArgsConstructor
public class CustomNotificationReadStateRepositoryImpl implements CustomNotificationReadStateRepository {

    private static final int MONGO_DUPLICATE_KEY = 11000;

    private final TenantAwareMongoTemplate mongoTemplate;

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
