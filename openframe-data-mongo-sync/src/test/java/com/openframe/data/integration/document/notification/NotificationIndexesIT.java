package com.openframe.data.integration.document.notification;

import com.openframe.data.config.notification.NotificationIndexes;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.IntegrationTestApplication;
import org.bson.Document;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = IntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class NotificationIndexesIT extends BaseMongoIntegrationTest {

    @Autowired
    private MongoTemplate mongoTemplate;

    @Test
    @DisplayName("Given the Notification entity, when indexes are resolved, then all three partial compound indexes exist with the expected key shape and partial filter")
    void given_notification_entity_when_indexes_resolved_then_all_compound_indexes_exist() {
        NotificationIndexes.ensure(mongoTemplate);

        Map<String, Document> byName = listIndexes();

        assertThat(byName).containsKeys(
                NotificationIndexes.USER_INDEX,
                NotificationIndexes.MACHINE_INDEX,
                NotificationIndexes.CLASS_INDEX);

        assertIndex(byName, NotificationIndexes.USER_INDEX,
                new Document("recipient.userId", 1).append("_id", -1),
                new Document("recipient._class", NotificationIndexes.USER_CLASS));

        assertIndex(byName, NotificationIndexes.MACHINE_INDEX,
                new Document("recipient.machineId", 1).append("_id", -1),
                new Document("recipient._class", NotificationIndexes.MACHINE_CLASS));

        assertIndex(byName, NotificationIndexes.CLASS_INDEX,
                new Document("recipient._class", 1).append("_id", -1),
                new Document("recipient._class", NotificationIndexes.BROADCAST_CLASS));
    }

    private Map<String, Document> listIndexes() {
        Map<String, Document> result = new HashMap<>();
        String collection = Notification.class.getAnnotation(
                org.springframework.data.mongodb.core.mapping.Document.class).collection();
        for (Document idx : mongoTemplate.getCollection(collection).listIndexes()) {
            result.put(idx.getString("name"), idx);
        }
        return result;
    }

    private static void assertIndex(Map<String, Document> byName,
                                    String name,
                                    Document expectedKey,
                                    Document expectedPartialFilter) {
        Document idx = byName.get(name);
        assertThat(idx).as("index %s should exist", name).isNotNull();
        assertThat(idx.get("key", Document.class))
                .as("index %s should have keys in the expected order", name)
                .isEqualTo(expectedKey);
        assertThat(idx.get("partialFilterExpression", Document.class))
                .as("index %s should have the expected partial filter", name)
                .isEqualTo(expectedPartialFilter);
    }
}
