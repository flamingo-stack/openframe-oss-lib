package com.openframe.data.nats.integration.publisher;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.notification.GenericContext;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationSeverity;
import com.openframe.data.nats.integration.BaseIntegrationTest;
import com.openframe.data.nats.integration.support.PublisherIntegrationTestApplication;
import com.openframe.data.nats.model.NotificationMessage;
import com.openframe.data.nats.publisher.NotificationNatsPublisher;
import io.nats.client.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(
        classes = PublisherIntegrationTestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE
)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class NotificationNatsPublisherIT extends BaseIntegrationTest {

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private NotificationNatsPublisher publisher;

    private Connection subscriber;

    @BeforeEach
    void setUp() throws Exception {
        subscriber = Nats.connect(natsUri());
    }

    @AfterEach
    void tearDown() throws Exception {
        if (subscriber != null) {
            subscriber.close();
        }
    }

    @Test
    @DisplayName("Given a subscriber on user.<userId>.notification, when publishToUser is called, then the message is delivered through the Spring Cloud Stream io.nats binder with the full payload (id, severity, title, context)")
    void publish_to_user_delivers_payload() throws Exception {
        Subscription sub = subscriber.subscribe("user.alice.notification");
        subscriber.flush(Duration.ofSeconds(2));

        Notification saved = persisted(Notification.builder()
                .title("Welcome aboard")
                .createdAt(Instant.now())
                .context(GenericContext.builder().type("welcome").payload("{\"k\":\"v\"}").build()));

        publisher.publishToUser("alice", saved, NotificationCategory.TICKETS);

        Message received = sub.nextMessage(Duration.ofSeconds(5));
        assertThat(received).isNotNull();
        NotificationMessage decoded = objectMapper.readValue(received.getData(), NotificationMessage.class);
        assertThat(decoded.getId()).isEqualTo(saved.getId());
        assertThat(decoded.getTitle()).isEqualTo("Welcome aboard");
        assertThat(decoded.getSeverity()).isEqualTo(NotificationSeverity.INFO);
        assertThat(decoded.getCategory()).isEqualTo(NotificationCategory.TICKETS);
        assertThat(decoded.getContext()).isInstanceOf(GenericContext.class);
        assertThat(decoded.getContext().getType()).isEqualTo("welcome");
        assertThat(((GenericContext) decoded.getContext()).getPayload()).isEqualTo("{\"k\":\"v\"}");
    }

    @Test
    @DisplayName("Given a subscriber on user.alice.notification, when publishToUser is called for a different userId, then alice's subscriber receives nothing — the binder routes per subject")
    void per_user_subjects_isolated() throws Exception {
        Subscription aliceSub = subscriber.subscribe("user.alice.notification");
        subscriber.flush(Duration.ofSeconds(2));

        Notification savedForBob = persisted(Notification.builder()
                .title("for bob")
                .context(GenericContext.builder().type("evt").payload("{}").build()));

        publisher.publishToUser("bob", savedForBob, NotificationCategory.GENERIC);

        assertThat(aliceSub.nextMessage(Duration.ofSeconds(1))).isNull();
    }

    @Test
    @DisplayName("Given subscribers on machine.m1 and machine.other, when publishToMachine is called for m1, then only m1's subscriber receives the message")
    void publish_to_machine_delivers_to_machine_subject() throws Exception {
        Subscription machineSub = subscriber.subscribe("machine.m1.notification");
        Subscription otherSub = subscriber.subscribe("machine.other.notification");
        subscriber.flush(Duration.ofSeconds(2));

        Notification saved = persisted(Notification.builder()
                .title("Machine event")
                .context(GenericContext.builder().type("event").payload("{}").build()));

        publisher.publishToMachine("m1", saved, NotificationCategory.DEVICES);

        assertThat(machineSub.nextMessage(Duration.ofSeconds(5))).isNotNull();
        assertThat(otherSub.nextMessage(Duration.ofSeconds(1))).isNull();
    }

    @Test
    @DisplayName("Given a notification without an id, when publishToUser is called, then IllegalArgumentException is raised before any broker call — caller must save() first")
    void unsaved_notification_throws() {
        Notification noId = Notification.builder()
                .title("not yet persisted")
                .context(GenericContext.builder().type("evt").payload("{}").build())
                .build();
        assertThatThrownBy(() -> publisher.publishToUser("alice", noId, NotificationCategory.GENERIC))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private static Notification persisted(Notification.NotificationBuilder builder) {
        return builder.id("not-" + System.nanoTime()).build();
    }
}
