package com.openframe.management.migration;

import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.IndexInfo;
import org.springframework.data.mongodb.core.index.IndexOperations;

import java.util.List;

// Notification.correlationId is gone; the index auto-index-creation built for it would otherwise
// keep an entry per notification for a field no document has.
@Slf4j
@ChangeUnit(id = "drop-notification-correlation-id-index", order = "013", author = "openframe")
public class DropNotificationCorrelationIdIndexChangeUnit {

    private static final String COLLECTION = "notifications";
    private static final String INDEX_NAME = "correlationId_1";

    @Execution
    public void execution(MongoTemplate mongoTemplate) {
        IndexOperations indexOperations = mongoTemplate.indexOps(COLLECTION);
        if (!hasCorrelationIdIndex(indexOperations)) {
            log.info("Index '{}' absent on '{}' — nothing to drop", INDEX_NAME, COLLECTION);
            return;
        }
        indexOperations.dropIndex(INDEX_NAME);
        log.info("Dropped index '{}' from '{}'", INDEX_NAME, COLLECTION);
    }

    private boolean hasCorrelationIdIndex(IndexOperations indexOperations) {
        List<IndexInfo> indexes = indexOperations.getIndexInfo();
        return indexes.stream()
                .map(IndexInfo::getName)
                .anyMatch(INDEX_NAME::equals);
    }

    @RollbackExecution
    public void rollback() {
    }
}
