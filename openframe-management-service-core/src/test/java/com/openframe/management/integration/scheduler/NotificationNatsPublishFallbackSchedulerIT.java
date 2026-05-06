package com.openframe.management.integration.scheduler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.core.exception.NatsException;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.nats.publisher.NatsMessagePublisher;
import com.openframe.data.nats.publisher.NotificationNatsPublisher;
import com.openframe.data.repository.notification.NotificationRepository;
import com.openframe.management.integration.BaseIntegrationTest;
import com.openframe.management.integration.support.IntegrationTestApplication;
import com.openframe.management.integration.support.NotificationFixtures;
import com.openframe.management.scheduler.NotificationNatsPublishFallbackScheduler;
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
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(
        classes = IntegrationTestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE
)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class NotificationNatsPublishFallbackSchedulerIT extends BaseIntegrationTest {

    @Autowired
    private NotificationRepository repository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    private Connection subscriberConnection;
    private Connection publisherConnection;
    private TogglingNats inner;
    private NotificationNatsPublishFallbackScheduler scheduler;

    @BeforeEach
    void setup() throws Exception {
        mongoTemplate.dropCollection(Notification.class);
        subscriberConnection = Nats.connect(natsUri());
        publisherConnection = Nats.connect(natsUri());

        inner = new TogglingNats(publisherConnection, objectMapper);
        NotificationNatsPublisher publisher = new NotificationNatsPublisher(inner, repository);
        scheduler = new NotificationNatsPublishFallbackScheduler(repository, publisher);
        ReflectionTestUtils.setField(scheduler, "maxPublishAttempts", 5);
        ReflectionTestUtils.setField(scheduler, "batchSize", 100);
    }

    @AfterEach
    void teardown() throws Exception {
        if (subscriberConnection != null) subscriberConnection.close();
        if (publisherConnection != null) publisherConnection.close();
    }

    @Test
    @DisplayName("Given a mix of fresh, under-cap, at-cap and already-published rows, when the scheduler runs, then only eligible rows are republished and the rest are left untouched")
    void given_mixed_publish_states_when_scheduler_runs_then_only_eligible_rows_published() throws Exception {
        Subscription aliceSub = subscriberConnection.subscribe("user.alice.notification");
        Subscription bobSub = subscriberConnection.subscribe("user.bob.notification");
        Subscription carolSub = subscriberConnection.subscribe("user.carol.notification");
        Subscription daveSub = subscriberConnection.subscribe("user.dave.notification");
        subscriberConnection.flush(Duration.ofSeconds(1));

        Notification fresh = repository.save(NotificationFixtures.basic("alice"));
        Notification underCap = repository.save(NotificationFixtures.withPublishState(
                "bob", NotificationFixtures.nonPublishedAttempts(2)));
        Notification atCap = repository.save(NotificationFixtures.withPublishState(
                "carol", NotificationFixtures.nonPublishedAttempts(5)));
        Notification done = repository.save(NotificationFixtures.withPublishState(
                "dave", NotificationFixtures.published()));

        scheduler.republishUnpublishedNotifications();

        assertThat(aliceSub.nextMessage(Duration.ofSeconds(2))).isNotNull();
        assertThat(bobSub.nextMessage(Duration.ofSeconds(2))).isNotNull();
        assertThat(carolSub.nextMessage(Duration.ofMillis(300))).isNull();
        assertThat(daveSub.nextMessage(Duration.ofMillis(300))).isNull();

        assertThat(repository.findById(fresh.getId()).orElseThrow().getPublishState().isPublished()).isTrue();
        assertThat(repository.findById(underCap.getId()).orElseThrow().getPublishState().isPublished()).isTrue();
        assertThat(repository.findById(atCap.getId()).orElseThrow().getPublishState().isPublished()).isFalse();
        assertThat(repository.findById(done.getId()).orElseThrow().getPublishState().isPublished()).isTrue();
    }

    @Test
    @DisplayName("Given a permanently failing broker, when the scheduler runs repeatedly, then the attempts counter grows up to the cap and stops — no further retries past max-attempts")
    void given_permanently_failing_broker_when_scheduler_runs_repeatedly_then_attempts_stop_at_cap() {
        ReflectionTestUtils.setField(scheduler, "maxPublishAttempts", 2);

        inner.shouldFail = true;
        Notification saved = repository.save(NotificationFixtures.basic("alice"));

        scheduler.republishUnpublishedNotifications();
        Notification afterFirst = repository.findById(saved.getId()).orElseThrow();
        assertThat(afterFirst.getPublishState().getAttempts()).isEqualTo(1);

        scheduler.republishUnpublishedNotifications();
        Notification afterSecond = repository.findById(saved.getId()).orElseThrow();
        assertThat(afterSecond.getPublishState().getAttempts()).isEqualTo(2);

        // attempts has hit the cap; subsequent sweeps must skip the row.
        scheduler.republishUnpublishedNotifications();
        Notification afterThird = repository.findById(saved.getId()).orElseThrow();
        assertThat(afterThird.getPublishState().getAttempts()).isEqualTo(2);
        assertThat(afterThird.getPublishState().isPublished()).isFalse();

        scheduler.republishUnpublishedNotifications();
        Notification afterFourth = repository.findById(saved.getId()).orElseThrow();
        assertThat(afterFourth.getPublishState().getAttempts()).isEqualTo(2);
        assertThat(afterFourth.getPublishState().isPublished()).isFalse();
    }

    @Test
    @DisplayName("Given a row left unpublished while NATS was down, when NATS comes back up and the scheduler runs, then the row is delivered and marked published")
    void given_nats_down_then_up_when_scheduler_runs_then_undelivered_row_is_recovered() throws Exception {
        Subscription aliceSub = subscriberConnection.subscribe("user.alice.notification");
        subscriberConnection.flush(Duration.ofSeconds(1));

        inner.shouldFail = true;
        Notification saved = repository.save(NotificationFixtures.basic("alice"));

        scheduler.republishUnpublishedNotifications();
        Notification stillBroken = repository.findById(saved.getId()).orElseThrow();
        assertThat(stillBroken.getPublishState().isPublished()).isFalse();
        assertThat(aliceSub.nextMessage(Duration.ofMillis(300))).isNull();

        inner.shouldFail = false;
        scheduler.republishUnpublishedNotifications();

        Message recovered = aliceSub.nextMessage(Duration.ofSeconds(2));
        assertThat(recovered).isNotNull();
        Notification recoveredRow = repository.findById(saved.getId()).orElseThrow();
        assertThat(recoveredRow.getPublishState().isPublished()).isTrue();
    }

    @Test
    @DisplayName("Given a publisher that throws on one row in the batch, when the scheduler runs, then the failure is logged and the rest of the batch is still delivered")
    void given_publisher_throws_on_one_row_when_scheduler_runs_then_rest_of_batch_still_delivered() throws Exception {
        Subscription bobSub = subscriberConnection.subscribe("user.bob.notification");
        subscriberConnection.flush(Duration.ofSeconds(1));

        Notification first = repository.save(NotificationFixtures.basic("alice"));
        Notification second = repository.save(NotificationFixtures.basic("bob"));

        TogglingNats failOnce = new TogglingNats(publisherConnection, objectMapper) {
            @Override
            public <T> void publish(String subject, T payload) {
                if (subject.contains("alice")) throw new NatsException("boom");
                super.publish(subject, payload);
            }
        };
        NotificationNatsPublisher resilientPublisher = new NotificationNatsPublisher(failOnce, repository);
        NotificationNatsPublishFallbackScheduler resilientScheduler =
                new NotificationNatsPublishFallbackScheduler(repository, resilientPublisher);
        ReflectionTestUtils.setField(resilientScheduler, "maxPublishAttempts", 5);
        ReflectionTestUtils.setField(resilientScheduler, "batchSize", 100);

        resilientScheduler.republishUnpublishedNotifications();

        assertThat(bobSub.nextMessage(Duration.ofSeconds(2))).isNotNull();
        Optional<Notification> firstRow = repository.findById(first.getId());
        Optional<Notification> secondRow = repository.findById(second.getId());
        assertThat(firstRow.orElseThrow().getPublishState().isPublished()).isFalse();
        assertThat(secondRow.orElseThrow().getPublishState().isPublished()).isTrue();
    }

    @Test
    @DisplayName("Given no retry candidates exist, when the scheduler runs, then it is a no-op and nothing is touched")
    void given_no_retry_candidates_when_scheduler_runs_then_no_op() {
        scheduler.republishUnpublishedNotifications();

        List<Notification> all = repository.findAll();
        assertThat(all).isEmpty();
    }

    static class TogglingNats extends NatsMessagePublisher {
        boolean shouldFail = false;
        private final Connection conn;
        private final ObjectMapper om;

        TogglingNats(Connection conn, ObjectMapper om) {
            super(null, om, conn);
            this.conn = conn;
            this.om = om;
        }

        @Override
        public <T> void publish(String subject, T payload) {
            if (shouldFail) {
                throw new NatsException("simulated outage for " + subject);
            }
            try {
                conn.publish(subject, om.writeValueAsBytes(payload));
                conn.flush(Duration.ofSeconds(1));
            } catch (Exception e) {
                throw new NatsException("test publish failed for " + subject, e);
            }
        }
    }
}
