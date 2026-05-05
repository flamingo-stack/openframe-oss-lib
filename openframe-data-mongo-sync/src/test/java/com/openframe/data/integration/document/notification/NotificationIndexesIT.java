package com.openframe.data.integration.document.notification;

import com.openframe.data.document.notification.Notification;
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
class NotificationIndexesIT extends BaseMongoIntegrationTest {

    @Autowired
    private MongoTemplate mongoTemplate;

    @Test
    @DisplayName("Given the Notification entity, when indexes are resolved, then all compound indexes exist with the expected key shape")
    void given_notification_entity_when_indexes_resolved_then_all_compound_indexes_exist() {
        IndexOperations indexOps = mongoTemplate.indexOps(Notification.class);
        new MongoPersistentEntityIndexResolver(mongoTemplate.getConverter().getMappingContext())
                .resolveIndexFor(Notification.class)
                .forEach(indexOps::ensureIndex);

        List<IndexInfo> indexes = indexOps.getIndexInfo();

        Map<String, IndexInfo> byName = indexes.stream()
                .collect(Collectors.toMap(IndexInfo::getName, i -> i));

        assertThat(byName).containsKeys(
                "recipient_user_id",
                "recipient_machine_id",
                "recipient_scope_id",
                "publish_state");

        assertThat(byName.get("recipient_user_id").getIndexFields())
                .extracting("key")
                .containsExactly("recipientUserId", "_id");
        assertThat(byName.get("recipient_machine_id").getIndexFields())
                .extracting("key")
                .containsExactly("recipientMachineId", "_id");
        assertThat(byName.get("recipient_scope_id").getIndexFields())
                .extracting("key")
                .containsExactly("recipientScope", "_id");

        assertThat(byName.get("publish_state").getIndexFields())
                .extracting("key")
                .containsExactly("publishState.published", "publishState.attempts");
    }
}
