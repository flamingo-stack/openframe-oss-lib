package com.openframe.notification.config;

import com.openframe.notification.spec.NotificationTypeSpec;
import com.openframe.notification.spec.UpdatableNotificationSpec;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.PartialIndexFilter;
import org.springframework.data.mongodb.core.query.Criteria;

// Declared here rather than on the document: the key is a map sub-path each spec chooses, which no
// annotation can express.
@Slf4j
@Configuration
@RequiredArgsConstructor
public class NotificationSourceIndexConfig {

    private static final String COLLECTION = "notifications";
    private static final String ATTRIBUTES_PREFIX = "attributes.";
    private static final String INDEX_NAME_PREFIX = "notifications_";
    private static final String INDEX_NAME_SUFFIX = "_idx";

    // Left behind by auto-index-creation for the removed Notification.correlationId.
    private static final String STALE_CORRELATION_INDEX = "correlationId_1";

    private final MongoTemplate mongoTemplate;
    private final ObjectProvider<NotificationTypeSpec<?>> specs;

    @PostConstruct
    public void initIndexes() {
        dropStaleIndex(STALE_CORRELATION_INDEX);
        specs.stream()
                .filter(UpdatableNotificationSpec.class::isInstance)
                .map(spec -> (UpdatableNotificationSpec<?>) spec)
                .map(spec -> spec.sourceIdAttr().getName())
                .distinct()
                .forEach(this::ensureSourceIdIndex);
    }

    // Partial: only approval-style notifications carry a source id, and they are the minority.
    private void ensureSourceIdIndex(String attributeKey) {
        String path = ATTRIBUTES_PREFIX + attributeKey;
        String name = INDEX_NAME_PREFIX + attributeKey + INDEX_NAME_SUFFIX;
        Index index = new Index().on(path, Sort.Direction.ASC)
                .named(name)
                .partial(PartialIndexFilter.of(Criteria.where(path).exists(true)));
        mongoTemplate.indexOps(COLLECTION).ensureIndex(index);
        log.info("Ensured notification source-id index '{}' on '{}'", name, path);
    }

    private void dropStaleIndex(String indexName) {
        try {
            mongoTemplate.indexOps(COLLECTION).dropIndex(indexName);
            log.info("Dropped stale index '{}' from collection '{}'", indexName, COLLECTION);
        } catch (Exception ex) {
            log.debug("Index '{}' not found on collection '{}', skipping", indexName, COLLECTION);
        }
    }
}
