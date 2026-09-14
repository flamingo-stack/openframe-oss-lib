package com.openframe.data.integration.repository.notification;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.IntegrationTestApplication;
import com.openframe.data.integration.support.NotificationFixtures;
import com.openframe.data.repository.notification.NotificationRepository;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = IntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class CustomNotificationRepositoryFindByAttributeIT extends BaseMongoIntegrationTest {

    private static final String COLLECTION = "notifications";
    private static final String SOURCE_KEY = "approvalRequestId";
    private static final String SOURCE_VALUE = "apr-1";

    @Autowired
    private NotificationRepository repository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void resetCollection() {
        mongoTemplate.dropCollection(Notification.class);
    }

    @Test
    @DisplayName("Given a notification carrying the attribute, when looked up by it, then that notification comes back")
    void finds_the_notification_by_its_attribute() {
        Notification stored = save(Map.of(SOURCE_KEY, SOURCE_VALUE));

        Optional<Notification> found = repository.findByAttribute(SOURCE_KEY, SOURCE_VALUE);

        assertThat(found).isPresent();
        assertThat(found.get().getId()).isEqualTo(stored.getId());
    }

    @Test
    @DisplayName("Given no notification carries the value, when looked up, then the result is empty rather than an arbitrary row")
    void unknown_value_returns_empty() {
        save(Map.of(SOURCE_KEY, SOURCE_VALUE));

        assertThat(repository.findByAttribute(SOURCE_KEY, "apr-other")).isEmpty();
    }

    @Test
    @DisplayName("Given a notification with no attributes at all, when looked up by an attribute, then it is not matched")
    void a_notification_without_attributes_is_never_matched() {
        repository.save(NotificationFixtures.basic());

        assertThat(repository.findByAttribute(SOURCE_KEY, SOURCE_VALUE)).isEmpty();
    }

    @Test
    @DisplayName("Given another tenant holds the same attribute value, when looked up, then only this tenant's notification is returned — the lookup key is unique per tenant, not globally")
    void another_tenants_notification_is_invisible() {
        Notification mine = save(Map.of(SOURCE_KEY, SOURCE_VALUE));
        mongoTemplate.getCollection(COLLECTION).insertOne(new Document()
                .append("tenantId", "another-tenant")
                .append("attributes", new Document(SOURCE_KEY, SOURCE_VALUE)));

        Optional<Notification> found = repository.findByAttribute(SOURCE_KEY, SOURCE_VALUE);

        assertThat(found).isPresent();
        assertThat(found.get().getId()).isEqualTo(mine.getId());
    }

    private Notification save(Map<String, String> attributes) {
        Notification notification = NotificationFixtures.basic();
        notification.setAttributes(attributes);
        return repository.save(notification);
    }
}
