package com.openframe.data.integration.service.notification;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationReadState;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.IntegrationTestApplication;
import com.openframe.data.service.notification.NotificationReadStateService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.IndexInfo;
import org.springframework.data.mongodb.core.index.MongoPersistentEntityIndexResolver;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = IntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class NotificationTtlIndexIT extends BaseMongoIntegrationTest {

    private static final String TTL_NOTIFICATIONS = "notifications_ttl";
    private static final String TTL_READ_STATES = "read_states_ttl";

    @Autowired
    private NotificationReadStateService service;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void resetCollections() {
        mongoTemplate.dropCollection(Notification.class);
        mongoTemplate.dropCollection(NotificationReadState.class);
        ensureIndexes(Notification.class);
        ensureIndexes(NotificationReadState.class);
    }

    @Test
    @DisplayName("Given the notifications collection, when indexes are resolved, then a TTL index on expireAt with expireAfterSeconds=0 exists")
    void notifications_collection_has_ttl_index() {
        Optional<IndexInfo> ttl = findIndex(Notification.class, TTL_NOTIFICATIONS);
        assertThat(ttl).isPresent();
        assertThat(ttl.get().getExpireAfter()).contains(Duration.ZERO);
    }

    @Test
    @DisplayName("Given the notification_read_states collection, when indexes are resolved, then a TTL index on expireAt with expireAfterSeconds=0 exists")
    void read_states_collection_has_ttl_index() {
        Optional<IndexInfo> ttl = findIndex(NotificationReadState.class, TTL_READ_STATES);
        assertThat(ttl).isPresent();
        assertThat(ttl.get().getExpireAfter()).contains(Duration.ZERO);
    }

    @Test
    @DisplayName("Given the default retention, when createForAudience persists a row, then expireAt is stamped roughly 30 days in the future")
    void create_for_audience_stamps_expire_at() {
        Instant before = Instant.now();
        service.createForAudience("notif-ttl", NotificationCategory.TICKETS, "title",
                RecipientType.USER, Set.of("user-ttl"));

        NotificationReadState row = mongoTemplate.findOne(
                new Query(Criteria.where("recipientId").is("user-ttl")), NotificationReadState.class);

        assertThat(row).isNotNull();
        assertThat(row.getExpireAt())
                .isAfter(before.plus(Duration.ofDays(29)))
                .isBefore(before.plus(Duration.ofDays(31)));
    }

    private Optional<IndexInfo> findIndex(Class<?> entityClass, String name) {
        List<IndexInfo> indexes = mongoTemplate.indexOps(entityClass).getIndexInfo();
        return indexes.stream().filter(idx -> name.equals(idx.getName())).findFirst();
    }

    private void ensureIndexes(Class<?> entityClass) {
        var indexOps = mongoTemplate.indexOps(entityClass);
        new MongoPersistentEntityIndexResolver(mongoTemplate.getConverter().getMappingContext())
                .resolveIndexFor(entityClass)
                .forEach(indexOps::ensureIndex);
    }
}
