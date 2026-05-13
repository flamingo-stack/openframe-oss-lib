package com.openframe.data.nats.integration.publisher;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.notification.BroadcastRecipient;
import com.openframe.data.document.notification.GenericContext;
import com.openframe.data.document.notification.MachineRecipient;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationSeverity;
import com.openframe.data.document.notification.UserRecipient;
import com.openframe.data.nats.integration.BaseIntegrationTest;
import com.openframe.data.nats.integration.support.PublisherIntegrationTestApplication;
import com.openframe.data.nats.model.NotificationMessage;
import com.openframe.data.nats.publisher.NatsMessagePublisher;
import com.openframe.data.nats.publisher.NotificationNatsPublisher;
import io.nats.client.Connection;
import io.nats.client.JetStream;
import io.nats.client.JetStreamApiException;
import io.nats.client.JetStreamManagement;
import io.nats.client.JetStreamSubscription;
import io.nats.client.Message;
import io.nats.client.Nats;
import io.nats.client.api.StorageType;
import io.nats.client.api.StreamConfiguration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
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
    private static final String BROADCAST_SUBJECT = "notification.broadcast";

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
    @DisplayName("Given a healthy JetStream stream, when publishing a user-scoped notification, then the message lands on the per-user subject and the subscriber receives it")
    void user_scope_delivered_to_per_user_subject() throws Exception {
        JetStreamSubscription sub = nats.jetStream().subscribe("user.alice.notification");

        Notification saved = persisted(Notification.builder()
                .recipient(new UserRecipient("alice"))
                .title("Welcome aboard")
                .createdAt(Instant.now())
                .context(GenericContext.builder().type("welcome").payload("{\"k\":\"v\"}").build()));

        publisher.publish(saved);

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
    @DisplayName("Given subscriptions on per-user subjects, when publishing for one user, then subscribers on other users' subjects do not receive the message — JetStream filtering by subject")
    void per_user_subjects_isolated() throws Exception {
        JetStreamSubscription aliceSub = nats.jetStream().subscribe("user.alice.notification");

        Notification savedForBob = persisted(Notification.builder()
                .recipient(new UserRecipient("bob"))
                .title("for bob")
                .context(GenericContext.builder().type("evt").payload("{}").build()));

        publisher.publish(savedForBob);

        assertThat(aliceSub.nextMessage(Duration.ofMillis(500))).isNull();
    }

    @Test
    @DisplayName("Given a MACHINE-scope notification, when publishing, then it is delivered on the per-machine subject and other subjects don't receive it")
    void machine_scope_delivered_to_per_machine_subject() throws Exception {
        JetStreamSubscription machineSub = nats.jetStream().subscribe("machine.m1.notification");
        JetStreamSubscription otherSub = nats.jetStream().subscribe("machine.other.notification");

        Notification saved = persisted(Notification.builder()
                .recipient(new MachineRecipient("m1"))
                .title("Machine event")
                .context(GenericContext.builder().type("event").payload("{}").build()));

        publisher.publish(saved);

        assertThat(machineSub.nextMessage(Duration.ofSeconds(2))).isNotNull();
        assertThat(otherSub.nextMessage(Duration.ofMillis(300))).isNull();
    }

    @Test
    @DisplayName("Given a broadcast (ALL-scope) notification, when publishing, then it lands on the tenant-wide broadcast subject")
    void broadcast_delivered_to_broadcast_subject() throws Exception {
        JetStreamSubscription broadcastSub = nats.jetStream().subscribe(BROADCAST_SUBJECT);
        JetStreamSubscription userSub = nats.jetStream().subscribe("user.alice.notification");

        Notification saved = persisted(Notification.builder()
                .recipient(new BroadcastRecipient())
                .title("Tenant ann")
                .context(GenericContext.builder().type("ann").payload("{}").build()));

        publisher.publish(saved);

        assertThat(broadcastSub.nextMessage(Duration.ofSeconds(2))).isNotNull();
        assertThat(userSub.nextMessage(Duration.ofMillis(300))).isNull();
    }

    @Test
    @DisplayName("Given a non-default severity and title, when publishing, then both round-trip through the JetStream wire payload to the subscriber")
    void non_default_severity_round_trips() throws Exception {
        JetStreamSubscription sub = nats.jetStream().subscribe("user.alice.notification");

        Notification saved = persisted(Notification.builder()
                .recipient(new UserRecipient("alice"))
                .severity(NotificationSeverity.DANGER)
                .title("Datastore unreachable")
                .createdAt(Instant.now())
                .context(GenericContext.builder().type("incident").payload("{}").build()));

        publisher.publish(saved);

        Message received = sub.nextMessage(Duration.ofSeconds(2));
        NotificationMessage decoded = objectMapper.readValue(received.getData(), NotificationMessage.class);
        assertThat(decoded.getSeverity()).isEqualTo(NotificationSeverity.DANGER);
        assertThat(decoded.getTitle()).isEqualTo("Datastore unreachable");
    }

    @Test
    @DisplayName("Given JetStream has persistence, when publishing before any subscriber attaches, then the message survives in the stream and the late subscriber still receives it — this is the property core NATS publish() did not provide")
    void persistence_replay_to_late_subscriber() throws Exception {
        Notification saved = persisted(Notification.builder()
                .recipient(new UserRecipient("alice"))
                .title("Stored before subscribe")
                .context(GenericContext.builder().type("evt").payload("{}").build()));

        publisher.publish(saved);

        JetStreamSubscription lateSub = nats.jetStream().subscribe("user.alice.notification");
        Message received = lateSub.nextMessage(Duration.ofSeconds(2));
        assertThat(received).isNotNull();
        NotificationMessage decoded = objectMapper.readValue(received.getData(), NotificationMessage.class);
        assertThat(decoded.getTitle()).isEqualTo("Stored before subscribe");
    }

    @Test
    @DisplayName("Given the JetStream stream is missing (broker not provisioned for our subjects), when publishing, then the failure is swallowed — Mongo is source of truth and clients reconcile via GraphQL catch-up")
    void missing_stream_publish_is_swallowed() throws Exception {
        deleteStreamIfExists();

        Notification saved = persisted(Notification.builder()
                .recipient(new UserRecipient("alice"))
                .title("would-fail")
                .context(GenericContext.builder().type("evt").payload("{}").build()));

        Notification result = publisher.publish(saved);

        assertThat(result).isSameAs(saved);
    }

    @Test
    @DisplayName("Given a null notification or a notification without an id, when publishing, then IllegalArgumentException is raised before any broker call — caller must save() first")
    void unsaved_notification_throws() {
        assertThatThrownBy(() -> publisher.publish(null))
                .isInstanceOf(IllegalArgumentException.class);

        Notification noId = Notification.builder()
                .recipient(new UserRecipient("alice"))
                .title("not yet persisted")
                .context(GenericContext.builder().type("evt").payload("{}").build())
                .build();
        assertThatThrownBy(() -> publisher.publish(noId))
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
                .subjects(USER_SUBJECT_PATTERN, MACHINE_SUBJECT_PATTERN, BROADCAST_SUBJECT)
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
