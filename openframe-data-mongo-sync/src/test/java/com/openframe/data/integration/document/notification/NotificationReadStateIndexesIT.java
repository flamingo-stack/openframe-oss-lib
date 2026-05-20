package com.openframe.data.integration.document.notification;

import com.openframe.data.document.notification.NotificationReadState;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.IntegrationTestApplication;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.IndexInfo;
import org.springframework.data.mongodb.core.index.IndexOperations;
import org.springframework.data.mongodb.core.index.MongoPersistentEntityIndexResolver;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = IntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class NotificationReadStateIndexesIT extends BaseMongoIntegrationTest {

    @Autowired
    private MongoTemplate mongoTemplate;

    @Test
    @DisplayName("Given the NotificationReadState entity, when indexes are resolved against Mongo, then the recipient-keyed compound indexes (unique recipient+notification, recipient+status, recipient+category+status) exist and the legacy user_read_at index is absent")
    void given_read_state_entity_when_indexes_resolved_then_required_compound_indexes_exist() {
        IndexOperations indexOps = mongoTemplate.indexOps(NotificationReadState.class);
        new MongoPersistentEntityIndexResolver(mongoTemplate.getConverter().getMappingContext())
                .resolveIndexFor(NotificationReadState.class)
                .forEach(indexOps::ensureIndex);

        List<IndexInfo> indexes = indexOps.getIndexInfo();
        Map<String, IndexInfo> byName = indexes.stream()
                .collect(Collectors.toMap(IndexInfo::getName, i -> i));

        assertThat(byName).containsKeys(
                "recipient_notification_unique",
                "recipient_status",
                "recipient_category_status");

        IndexInfo unique = byName.get("recipient_notification_unique");
        assertThat(unique.isUnique()).isTrue();
        assertThat(unique.getIndexFields()).extracting("key")
                .containsExactly("recipientId", "recipientType", "notificationId");

        assertThat(byName.get("recipient_status").getIndexFields()).extracting("key")
                .containsExactly("recipientId", "recipientType", "status");

        assertThat(byName.get("recipient_category_status").getIndexFields()).extracting("key")
                .containsExactly("recipientId", "recipientType", "category", "status");

        assertThat(byName).doesNotContainKey("user_read_at");
    }
}
