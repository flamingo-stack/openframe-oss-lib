package com.openframe.data.integration.document.notification;

import com.openframe.data.document.notification.GenericContext;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationContext;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.IntegrationTestApplication;
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
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/** Round-trips polymorphic {@code context} through Mongo and verifies no {@code _class} leakage. */
@SpringBootTest(classes = IntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class NotificationContextDispatchIT extends BaseMongoIntegrationTest {

    @Autowired
    private NotificationRepository repository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void resetCollection() {
        mongoTemplate.dropCollection(Notification.class);
    }

    @Test
    @DisplayName("Given a saved Notification with an extended context, when re-read, then context comes back as the concrete subclass with its extra fields populated")
    void given_extended_context_when_reread_then_dispatches_to_concrete_subclass() {
        Notification original = Notification.builder()
                .recipientUserId("user-1")
                .title("Extended event")
                .createdAt(Instant.now())
                .context(TestExtendedContext.builder()
                        .type(TestExtendedContext.TYPE)
                        .extraField("extra-value")
                        .extraNumber(42)
                        .build())
                .build();

        Notification persisted = repository.save(original);
        Optional<Notification> retrieved = repository.findById(persisted.getId());

        assertThat(retrieved).isPresent();
        assertThat(retrieved.get().getContext()).isInstanceOf(TestExtendedContext.class);

        TestExtendedContext context = (TestExtendedContext) retrieved.get().getContext();
        assertThat(context.getType()).isEqualTo(TestExtendedContext.TYPE);
        assertThat(context.getExtraField()).isEqualTo("extra-value");
        assertThat(context.getExtraNumber()).isEqualTo(42);
    }

    @Test
    @DisplayName("Given a saved Notification with a generic context, when re-read, then context comes back as GenericContext with payload preserved")
    void given_generic_context_when_reread_then_round_trips_as_generic() {
        Notification original = Notification.builder()
                .recipientUserId("user-1")
                .title("Plain event")
                .createdAt(Instant.now())
                .context(GenericContext.builder().type("plain-event").payload("{\"k\":\"v\"}").build())
                .build();

        Notification persisted = repository.save(original);
        Optional<Notification> retrieved = repository.findById(persisted.getId());

        assertThat(retrieved).isPresent();
        assertThat(retrieved.get().getContext()).isInstanceOf(GenericContext.class);

        GenericContext context = (GenericContext) retrieved.get().getContext();
        assertThat(context.getType()).isEqualTo("plain-event");
        assertThat(context.getPayload()).isEqualTo("{\"k\":\"v\"}");
    }

    @Test
    @DisplayName("Given a saved Notification, when inspecting the raw Mongo document, then the embedded context has no internal _class field — type is the sole discriminator")
    void given_saved_notification_when_inspecting_raw_doc_then_context_has_no_class_field() {
        Notification original = Notification.builder()
                .recipientUserId("user-1")
                .title("Extended event")
                .createdAt(Instant.now())
                .context(TestExtendedContext.builder()
                        .type(TestExtendedContext.TYPE)
                        .extraField("v")
                        .extraNumber(1)
                        .build())
                .build();
        Notification persisted = repository.save(original);

        Document raw = mongoTemplate.findOne(
                Query.query(Criteria.where("_id").is(persisted.getId())),
                Document.class,
                "notifications");

        assertThat(raw).isNotNull();
        Document context = raw.get("context", Document.class);
        assertThat(context).isNotNull();
        assertThat(context.getString("type")).isEqualTo(TestExtendedContext.TYPE);
        assertThat(context.containsKey("_class"))
                .as("context document should not carry _class — type is the canonical discriminator")
                .isFalse();
    }
}
