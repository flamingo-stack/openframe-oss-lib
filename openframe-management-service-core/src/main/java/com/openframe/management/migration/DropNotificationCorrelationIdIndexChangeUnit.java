package com.openframe.management.migration;

import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.IndexField;
import org.springframework.data.mongodb.core.index.IndexInfo;
import org.springframework.data.mongodb.core.index.IndexOperations;

import java.util.List;

// Notification.correlationId is gone; the index auto-index-creation built for it would otherwise
// keep an entry per notification for a field no document has. Matched by key rather than by name:
// Spring Data's @Indexed names it after the property ("correlationId"), not Mongo's "correlationId_1".
@Slf4j
@ChangeUnit(id = "drop-notification-correlation-id-index", order = "013", author = "openframe")
public class DropNotificationCorrelationIdIndexChangeUnit {

    private static final String COLLECTION = "notifications";
    private static final String FIELD = "correlationId";

    @Execution
    public void execution(MongoTemplate mongoTemplate) {
        IndexOperations indexOperations = mongoTemplate.indexOps(COLLECTION);
        List<String> names = correlationIdIndexNames(indexOperations);
        if (names.isEmpty()) {
            log.info("No index on '{}.{}' — nothing to drop", COLLECTION, FIELD);
            return;
        }
        names.forEach(indexOperations::dropIndex);
        log.info("Dropped index(es) {} on '{}.{}'", names, COLLECTION, FIELD);
    }

    private List<String> correlationIdIndexNames(IndexOperations indexOperations) {
        List<IndexInfo> indexes = indexOperations.getIndexInfo();
        return indexes.stream()
                .filter(this::isCorrelationIdIndex)
                .map(IndexInfo::getName)
                .toList();
    }

    private boolean isCorrelationIdIndex(IndexInfo index) {
        List<IndexField> fields = index.getIndexFields();
        if (fields.size() != 1) {
            return false;
        }
        IndexField field = fields.get(0);
        String key = field.getKey();
        return FIELD.equals(key);
    }

    @RollbackExecution
    public void rollback() {
    }
}
