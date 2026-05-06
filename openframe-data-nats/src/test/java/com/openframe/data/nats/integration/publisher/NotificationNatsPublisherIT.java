package com.openframe.data.nats.integration.publisher;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.core.exception.NatsException;
import com.openframe.data.document.notification.GenericContext;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationSeverity;
import com.openframe.data.document.notification.RecipientScope;
import com.openframe.data.nats.integration.BaseIntegrationTest;
import com.openframe.data.nats.integration.support.NotificationFixtures;
import com.openframe.data.nats.integration.support.PublisherIntegrationTestApplication;
import com.openframe.data.nats.integration.support.TestPublisherContext;
import com.openframe.data.nats.model.NotificationMessage;
import com.openframe.data.nats.publisher.NatsMessagePublisher;
import com.openframe.data.nats.publisher.NotificationNatsPublisher;
import com.openframe.data.repository.notification.NotificationRepository;
import io.nats.client.Connection;
import io.nats.client.Message;
import io.nats.client.Nats;
import io.nats.client.Subscription;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.time.Duration;

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
    private NotificationRepository repository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    private Connection subscriberConnection;
    private Connection publisherConnection;

    @BeforeEach
    void setup() throws Exception {
        mongoTemplate.dropCollection(Notification.class);
        subscriberConnection = Nats.connect(natsUri());
        publisherConnection = Nats.connect(natsUri());
    }

    @AfterEach
    void teardown() throws Exception {
        if (subscriberConnection != null) subscriberConnection.close();
        if (publisherConnection != null) publisherConnection.close();
    }

    @Test
    @DisplayName("Given a healthy NATS connection, when publishing, then the message is delivered to the per-user subject and the row is marked published")
    void given_healthy_nats_when_publishing_then_message_delivered_and_row_marked_published() throws Exception {
        Subscription sub = subscriberConnection.subscribe("user.alice.notification");
        subscriberConnection.flush(Duration.ofSeconds(1));

        NotificationNatsPublisher publisher = new NotificationNatsPublisher(
                realNats(publisherConnection), repository);
        Notification saved = repository.save(NotificationFixtures.basic("alice"));

        Notification result = publisher.publish(saved);

        assertThat(result.getPublishState().isPublished()).isTrue();

        Message received = sub.nextMessage(Duration.ofSeconds(2));
        assertThat(received).isNotNull();

        NotificationMessage decoded = objectMapper.readValue(received.getData(), NotificationMessage.class);
        assertThat(decoded.getId()).isEqualTo(saved.getId());
        assertThat(decoded.getRecipientUserId()).isEqualTo("alice");
        assertThat(decoded.getSeverity()).isEqualTo(saved.getSeverity());
        assertThat(decoded.getTitle()).isEqualTo(saved.getTitle());
        assertThat(decoded.getContext()).isInstanceOf(GenericContext.class);
        assertThat(decoded.getContext().getType()).isEqualTo(saved.getContext().getType());
        assertThat(((GenericContext) decoded.getContext()).getPayload())
                .isEqualTo(((GenericContext) saved.getContext()).getPayload());

        Notification reread = repository.findById(saved.getId()).orElseThrow();
        assertThat(reread.getPublishState()).isNotNull();
        assertThat(reread.getPublishState().isPublished()).isTrue();
        assertThat(reread.getPublishState().getPublishedAt()).isNotNull();
    }

    @Test
    @DisplayName("Given subscriptions on per-user subjects, when publishing for one user, then subscribers on other users' subjects do not receive the message")
    void given_per_user_subjects_when_publishing_for_one_user_then_other_subjects_dont_receive() throws Exception {
        Subscription aliceSub = subscriberConnection.subscribe("user.alice.notification");
        subscriberConnection.flush(Duration.ofSeconds(1));

        NotificationNatsPublisher publisher = new NotificationNatsPublisher(
                realNats(publisherConnection), repository);
        Notification savedForBob = repository.save(NotificationFixtures.basic("bob"));

        publisher.publish(savedForBob);

        Message received = aliceSub.nextMessage(Duration.ofMillis(500));
        assertThat(received).isNull();
    }

    @Test
    @DisplayName("Given a NATS broker that always fails, when publishing for the first time, then the row stays unpublished and the attempts counter advances to 1")
    void given_failing_broker_when_publishing_first_time_then_attempts_counter_advances() {
        NotificationNatsPublisher publisher = new NotificationNatsPublisher(
                alwaysFails(), repository);
        Notification saved = repository.save(NotificationFixtures.basic("alice"));

        Notification result = publisher.publish(saved);

        assertThat(result.getPublishState().isPublished()).isFalse();
        Notification reread = repository.findById(saved.getId()).orElseThrow();
        assertThat(reread.getPublishState()).isNotNull();
        assertThat(reread.getPublishState().isPublished()).isFalse();
        assertThat(reread.getPublishState().getAttempts()).isEqualTo(1);
    }

    @Test
    @DisplayName("Given a NATS broker that always fails, when publishing repeatedly, then each retry increments the attempts counter on the row")
    void given_failing_broker_when_publishing_repeatedly_then_attempts_counter_grows() {
        NotificationNatsPublisher publisher = new NotificationNatsPublisher(
                alwaysFails(), repository);
        Notification saved = repository.save(NotificationFixtures.basic("alice"));

        publisher.publish(saved);
        assertThat(repository.findById(saved.getId()).orElseThrow()
                .getPublishState().getAttempts()).isEqualTo(1);

        publisher.publish(repository.findById(saved.getId()).orElseThrow());
        assertThat(repository.findById(saved.getId()).orElseThrow()
                .getPublishState().getAttempts()).isEqualTo(2);

        publisher.publish(repository.findById(saved.getId()).orElseThrow());
        assertThat(repository.findById(saved.getId()).orElseThrow()
                .getPublishState().getAttempts()).isEqualTo(3);
        assertThat(repository.findById(saved.getId()).orElseThrow()
                .getPublishState().isPublished()).isFalse();
    }

    @Test
    @DisplayName("Given a non-default severity and title, when publishing, then both round-trip through the NATS wire payload to the subscriber")
    void given_non_default_severity_and_title_when_publishing_then_round_trip_to_subscriber() throws Exception {
        Subscription sub = subscriberConnection.subscribe("user.alice.notification");
        subscriberConnection.flush(Duration.ofSeconds(1));

        NotificationNatsPublisher publisher = new NotificationNatsPublisher(
                realNats(publisherConnection), repository);
        Notification withDanger = Notification.builder()
                .recipientUserId("alice")
                .severity(NotificationSeverity.DANGER)
                .title("Datastore unreachable")
                .context(GenericContext.builder().type("incident").payload("{\"k\":\"v\"}").build())
                .build();
        Notification saved = repository.save(withDanger);

        publisher.publish(saved);

        Message received = sub.nextMessage(Duration.ofSeconds(2));
        NotificationMessage decoded = objectMapper.readValue(received.getData(), NotificationMessage.class);
        assertThat(decoded.getSeverity()).isEqualTo(NotificationSeverity.DANGER);
        assertThat(decoded.getTitle()).isEqualTo("Datastore unreachable");
    }

    @Test
    @DisplayName("Given a notification that has not been persisted yet, when publishing, then IllegalArgumentException is raised — caller must save() first")
    void given_unsaved_notification_when_publishing_then_throws_illegal_argument() {
        NotificationNatsPublisher publisher = new NotificationNatsPublisher(
                realNats(publisherConnection), repository);

        assertThatThrownBy(() -> publisher.publish(null))
                .isInstanceOf(IllegalArgumentException.class);

        Notification noId = NotificationFixtures.basic("alice");
        assertThatThrownBy(() -> publisher.publish(noId))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("Given a MACHINE-scope notification, when publishing, then it is delivered on the per-machine subject and other subjects don't receive it")
    void given_machine_scope_when_publishing_then_per_machine_subject_receives() throws Exception {
        Subscription machineSub = subscriberConnection.subscribe("machine.m1.notification");
        Subscription otherMachineSub = subscriberConnection.subscribe("machine.other.notification");
        subscriberConnection.flush(Duration.ofSeconds(1));

        NotificationNatsPublisher publisher = new NotificationNatsPublisher(
                realNats(publisherConnection), repository);
        Notification saved = repository.save(Notification.builder()
                .recipientScope(RecipientScope.MACHINE)
                .recipientMachineId("m1")
                .title("Machine event")
                .context(GenericContext.builder().type("event").payload("{}").build())
                .build());

        publisher.publish(saved);

        assertThat(machineSub.nextMessage(Duration.ofSeconds(2))).isNotNull();
        assertThat(otherMachineSub.nextMessage(Duration.ofMillis(300))).isNull();
    }

    @Test
    @DisplayName("Given a broadcast (ALL-scope) notification, when publishing, then it lands on the tenant-wide broadcast subject")
    void given_broadcast_scope_when_publishing_then_broadcast_subject_receives() throws Exception {
        Subscription broadcastSub = subscriberConnection.subscribe("notification.broadcast");
        Subscription userSub = subscriberConnection.subscribe("user.alice.notification");
        subscriberConnection.flush(Duration.ofSeconds(1));

        NotificationNatsPublisher publisher = new NotificationNatsPublisher(
                realNats(publisherConnection), repository);
        Notification saved = repository.save(Notification.builder()
                .recipientScope(RecipientScope.ALL)
                .title("Tenant ann")
                .context(GenericContext.builder().type("ann").payload("{}").build())
                .build());

        publisher.publish(saved);

        assertThat(broadcastSub.nextMessage(Duration.ofSeconds(2))).isNotNull();
        // Per-user subject must NOT receive a broadcast — clients pick it up on the broadcast subject.
        assertThat(userSub.nextMessage(Duration.ofMillis(300))).isNull();
    }

    @Test
    @DisplayName("Given a USER-scope notification with a blank recipientUserId, when publishing, then IllegalStateException is raised — invariants enforced before any send")
    void given_user_scope_without_recipient_user_id_when_publishing_then_throws() {
        NotificationNatsPublisher publisher = new NotificationNatsPublisher(
                realNats(publisherConnection), repository);
        // Bypass NotificationPublishingService.validate() by going straight to the repository — we want
        // to exercise the publisher's own scope/id consistency check.
        Notification badUser = repository.save(Notification.builder()
                .recipientScope(RecipientScope.USER)
                .title("missing user id")
                .context(GenericContext.builder().type("event").payload("{}").build())
                .build());

        assertThatThrownBy(() -> publisher.publish(badUser))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("recipientUserId");
    }

    @Test
    @DisplayName("Given a MACHINE-scope notification with a blank recipientMachineId, when publishing, then IllegalStateException is raised")
    void given_machine_scope_without_recipient_machine_id_when_publishing_then_throws() {
        NotificationNatsPublisher publisher = new NotificationNatsPublisher(
                realNats(publisherConnection), repository);
        Notification badMachine = repository.save(Notification.builder()
                .recipientScope(RecipientScope.MACHINE)
                .title("missing machine id")
                .context(GenericContext.builder().type("event").payload("{}").build())
                .build());

        assertThatThrownBy(() -> publisher.publish(badMachine))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("recipientMachineId");
    }

    @Test
    @DisplayName("Given a context whose type token is not registered with any binding, when publishing, then the subscriber decodes it as GenericContext via @JsonTypeInfo defaultImpl — forward-compat for new producer-side types reaching old subscribers")
    void given_unregistered_context_type_when_publishing_then_subscriber_falls_back_to_generic() throws Exception {
        Subscription sub = subscriberConnection.subscribe("user.alice.notification");
        subscriberConnection.flush(Duration.ofSeconds(1));

        NotificationNatsPublisher publisher = new NotificationNatsPublisher(
                realNats(publisherConnection), repository);
        // type=NEW_TYPE_FROM_FUTURE_PRODUCER is not registered via any
        // NotificationContextBinding — Jackson should fall through to defaultImpl.
        Notification withUnregistered = Notification.builder()
                .recipientUserId("alice")
                .title("From the future")
                .context(GenericContext.builder()
                        .type("NEW_TYPE_FROM_FUTURE_PRODUCER")
                        .payload("{\"future\":\"data\"}")
                        .build())
                .build();
        Notification saved = repository.save(withUnregistered);

        publisher.publish(saved);

        Message received = sub.nextMessage(Duration.ofSeconds(2));
        NotificationMessage decoded = objectMapper.readValue(received.getData(), NotificationMessage.class);

        assertThat(decoded.getContext()).isInstanceOf(GenericContext.class);
        assertThat(decoded.getContext().getType()).isEqualTo("NEW_TYPE_FROM_FUTURE_PRODUCER");
        assertThat(((GenericContext) decoded.getContext()).getPayload()).isEqualTo("{\"future\":\"data\"}");
    }

    @Test
    @DisplayName("Given a notification with a typed (non-Generic) context, when publishing, then the subscriber decodes it back into the same concrete subclass with all fields preserved")
    void given_typed_context_when_publishing_then_subscriber_decodes_into_same_subclass() throws Exception {
        Subscription sub = subscriberConnection.subscribe("user.alice.notification");
        subscriberConnection.flush(Duration.ofSeconds(1));

        NotificationNatsPublisher publisher = new NotificationNatsPublisher(
                realNats(publisherConnection), repository);
        Notification withTyped = Notification.builder()
                .recipientUserId("alice")
                .title("Approval requested")
                .context(TestPublisherContext.builder()
                        .type(TestPublisherContext.TYPE)
                        .ticketId("ticket-99")
                        .priority(7)
                        .build())
                .build();
        Notification saved = repository.save(withTyped);

        publisher.publish(saved);

        Message received = sub.nextMessage(Duration.ofSeconds(2));
        NotificationMessage decoded = objectMapper.readValue(received.getData(), NotificationMessage.class);

        assertThat(decoded.getContext()).isInstanceOf(TestPublisherContext.class);
        TestPublisherContext context = (TestPublisherContext) decoded.getContext();
        assertThat(context.getType()).isEqualTo(TestPublisherContext.TYPE);
        assertThat(context.getTicketId()).isEqualTo("ticket-99");
        assertThat(context.getPriority()).isEqualTo(7);
    }

    private NatsMessagePublisher realNats(Connection conn) {
        return new NatsMessagePublisher(null, objectMapper, conn) {
            @Override
            public <T> void publish(String subject, T payload) {
                try {
                    conn.publish(subject, objectMapper.writeValueAsBytes(payload));
                    conn.flush(Duration.ofSeconds(1));
                } catch (Exception e) {
                    throw new NatsException("test publish failed for " + subject, e);
                }
            }
        };
    }

    private NatsMessagePublisher alwaysFails() {
        return new NatsMessagePublisher(null, objectMapper, publisherConnection) {
            @Override
            public <T> void publish(String subject, T payload) {
                throw new NatsException("simulated broker outage");
            }
        };
    }
}
