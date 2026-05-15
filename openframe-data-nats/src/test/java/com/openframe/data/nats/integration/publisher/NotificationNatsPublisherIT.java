package com.openframe.data.nats.integration.publisher;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.notification.GenericContext;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationSeverity;
import com.openframe.data.nats.integration.BaseIntegrationTest;
import com.openframe.data.nats.integration.support.PublisherIntegrationTestApplication;
import com.openframe.data.nats.model.NotificationMessage;
import com.openframe.data.nats.publisher.NatsMessagePublisher;
import com.openframe.data.nats.publisher.NotificationNatsPublisher;
import io.nats.client.*;
import io.nats.client.api.StorageType;
import io.nats.client.api.StreamConfiguration;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.io.IOException;
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

    private static final String STREAM = "NOTIFICATIONS";
    private static final String USER_SUBJECT_PATTERN = "user.*.notification";
    private static final String MACHINE_SUBJECT_PATTERN = "machine.*.notification";

    @Autowired
    private ObjectMapper objectMapper;

    private Connection nats;
    private NotificationNatsPublisher publisher;

    @BeforeEach
    void setUp() throws Exception {
        nats = Nats.connect(natsUri());
        ensureFreshStream();
        publisher = new NotificationNatsPublisher(new NatsMessagePublisher(null, objectMapper, nats));
    }

    @AfterEach
    void tearDown() throws Exception {
        if (nats != null) {
            deleteStreamIfExists();
            nats.close();
        }
    }

    @Test
    @DisplayName("Given a healthy JetStream stream and a persisted notification, when publishToUser is called, then the message lands on user.<userId>.notification and a subscriber receives the full payload (id, severity, title, context)")
    void publish_to_user_delivers_payload() throws Exception {
        JetStreamSubscription sub = nats.jetStream().subscribe("user.alice.notification");

        Notification saved = persisted(Notification.builder()
                .title("Welcome aboard")
                .createdAt(Instant.now())
                .context(GenericContext.builder().type("welcome").payload("{\"k\":\"v\"}").build()));

        publisher.publishToUser("alice", saved);

        Message received = sub.nextMessage(Duration.ofSeconds(2));
        assertThat(received).isNotNull();
        NotificationMessage decoded = objectMapper.readValue(received.getData(), NotificationMessage.class);
        assertThat(decoded.getId()).isEqualTo(saved.getId());
        assertThat(decoded.getTitle()).isEqualTo("Welcome aboard");
        assertThat(decoded.getSeverity()).isEqualTo(NotificationSeverity.INFO);
        assertThat(decoded.getContext()).isInstanceOf(GenericContext.class);
        assertThat(decoded.getContext().getType()).isEqualTo("welcome");
        assertThat(((GenericContext) decoded.getContext()).getPayload()).isEqualTo("{\"k\":\"v\"}");
    }

    @Test
    @DisplayName("Given a subscriber on user.alice.notification, when publishToUser is called for a different userId, then alice's subscriber does not receive the message — JetStream filters by subject")
    void per_user_subjects_isolated() throws Exception {
        JetStreamSubscription aliceSub = nats.jetStream().subscribe("user.alice.notification");

        Notification savedForBob = persisted(Notification.builder()
                .title("for bob")
                .context(GenericContext.builder().type("evt").payload("{}").build()));

        publisher.publishToUser("bob", savedForBob);

        assertThat(aliceSub.nextMessage(Duration.ofMillis(500))).isNull();
    }

    @Test
    @DisplayName("Given subscribers on machine.m1 and machine.other subjects, when publishToMachine is called for m1, then only m1's subscriber receives the message")
    void publish_to_machine_delivers_to_machine_subject() throws Exception {
        JetStreamSubscription machineSub = nats.jetStream().subscribe("machine.m1.notification");
        JetStreamSubscription otherSub = nats.jetStream().subscribe("machine.other.notification");

        Notification saved = persisted(Notification.builder()
                .title("Machine event")
                .context(GenericContext.builder().type("event").payload("{}").build()));

        publisher.publishToMachine("m1", saved);

        assertThat(machineSub.nextMessage(Duration.ofSeconds(2))).isNotNull();
        assertThat(otherSub.nextMessage(Duration.ofMillis(300))).isNull();
    }

    @Test
    @DisplayName("Given JetStream persistence enabled, when a message is published before any subscriber attaches, then a late subscriber that attaches afterwards still receives the message — the property core NATS publish() did not provide")
    void persistence_replay_to_late_subscriber() throws Exception {
        Notification saved = persisted(Notification.builder()
                .title("Stored before subscribe")
                .context(GenericContext.builder().type("evt").payload("{}").build()));

        publisher.publishToUser("alice", saved);

        JetStreamSubscription lateSub = nats.jetStream().subscribe("user.alice.notification");
        Message received = lateSub.nextMessage(Duration.ofSeconds(2));
        assertThat(received).isNotNull();
        NotificationMessage decoded = objectMapper.readValue(received.getData(), NotificationMessage.class);
        assertThat(decoded.getTitle()).isEqualTo("Stored before subscribe");
    }

    @Test
    @DisplayName("Given the JetStream stream is missing (broker not provisioned for our subjects), when publishToUser is called, then the failure is swallowed — Mongo is source of truth and clients reconcile via GraphQL catch-up")
    void missing_stream_publish_swallowed() throws Exception {
        deleteStreamIfExists();

        Notification saved = persisted(Notification.builder()
                .title("would-fail")
                .context(GenericContext.builder().type("evt").payload("{}").build()));

        publisher.publishToUser("alice", saved);
        // void return now; no exception escapes.
    }

    @Test
    @DisplayName("Given a notification without an id, when publishToUser is called, then IllegalArgumentException is raised before any broker call — caller must save() first")
    void unsaved_notification_throws() {
        Notification noId = Notification.builder()
                .title("not yet persisted")
                .context(GenericContext.builder().type("evt").payload("{}").build())
                .build();
        assertThatThrownBy(() -> publisher.publishToUser("alice", noId))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private static Notification persisted(Notification.NotificationBuilder builder) {
        return builder.id("not-" + System.nanoTime()).build();
    }

    private void ensureFreshStream() throws IOException, JetStreamApiException {
        JetStreamManagement jsm = nats.jetStreamManagement();
        try {
            jsm.deleteStream(STREAM);
        } catch (JetStreamApiException ignored) {
        }
        jsm.addStream(StreamConfiguration.builder()
                .name(STREAM)
                .subjects(USER_SUBJECT_PATTERN, MACHINE_SUBJECT_PATTERN)
                .storageType(StorageType.Memory)
                .build());
    }

    private void deleteStreamIfExists() throws IOException {
        try {
            nats.jetStreamManagement().deleteStream(STREAM);
        } catch (JetStreamApiException ignored) {
        }
    }
}
