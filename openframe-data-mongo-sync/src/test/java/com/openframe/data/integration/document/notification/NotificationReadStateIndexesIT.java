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
    @DisplayName("Given the NotificationReadState entity, when indexes are resolved, then the unique (userId, notificationId) and (userId, readAt) compound indexes exist")
    void given_read_state_entity_when_indexes_resolved_then_unique_user_notification_and_user_read_at_exist() {
        IndexOperations indexOps = mongoTemplate.indexOps(NotificationReadState.class);
        new MongoPersistentEntityIndexResolver(mongoTemplate.getConverter().getMappingContext())
                .resolveIndexFor(NotificationReadState.class)
                .forEach(indexOps::ensureIndex);

        List<IndexInfo> indexes = indexOps.getIndexInfo();

        Map<String, IndexInfo> byName = indexes.stream()
                .collect(Collectors.toMap(IndexInfo::getName, i -> i));

        assertThat(byName).containsKey("user_notification_unique");
        assertThat(byName).containsKey("user_read_at");

        IndexInfo unique = byName.get("user_notification_unique");
        assertThat(unique.isUnique()).isTrue();
        assertThat(unique.getIndexFields())
                .extracting("key")
                .containsExactly("userId", "notificationId");

        assertThat(byName.get("user_read_at").getIndexFields())
                .extracting("key")
                .containsExactly("userId", "readAt");
    }
}
