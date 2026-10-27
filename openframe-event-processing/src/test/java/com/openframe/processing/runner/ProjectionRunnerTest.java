package com.openframe.processing.runner;

import com.mongodb.MongoNotPrimaryException;
import com.mongodb.ServerAddress;
import com.openframe.processing.config.EventProcessingAutoConfiguration;
import com.openframe.processing.exception.EventProcessingFailedException;
import com.openframe.processing.exception.MongoUnavailableException;
import com.openframe.processing.fixture.Widgets.RecordingProjection;
import com.openframe.processing.fixture.Widgets.WidgetEvent;
import com.openframe.processing.fixture.Widgets.WidgetSpec;
import com.openframe.publishing.api.model.PublishedRecord;
import com.openframe.publishing.api.spec.Projection;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.bson.BsonDocument;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.assertj.AssertableApplicationContext;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.mongodb.UncategorizedMongoDbException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Through EventProcessingAutoConfiguration: real spec registry and metrics; one projection per call, as each has its own listener.
class ProjectionRunnerTest {

    private static final String ORGANIZATIONS = "organizations";
    private static final String ON_TICKETS = "widget-on-tickets";

    private final RecordingProjection onTickets = new RecordingProjection(ON_TICKETS);

    @Test
    void anEvent_reachesItsProjection_withTheEnvelopesTenantAndVersion() {
        runnerWith(onTickets).run(context -> {
            process(context, onTickets, record(false));

            assertThat(onTickets.records).singleElement().satisfies(applied -> {
                assertThat(applied.getTenantId()).isEqualTo("tenant-1");
                assertThat(applied.getVersion()).isEqualTo(3L);
            });
            assertThat(timerCount(context, ON_TICKETS, EventProcessingMetrics.OUTCOME_APPLIED)).isEqualTo(1);
        });
    }

    @Test
    void aDelete_reachesNoProjection() {
        runnerWith(onTickets).run(context -> {
            process(context, onTickets, record(true));

            assertThat(onTickets.records).isEmpty();
        });
    }

    @Test
    void aFailingProjection_isNamedInTheException_withItsFailureAsTheCause() {
        IllegalStateException bug = new IllegalStateException("bug");
        RecordingProjection failing = new RecordingProjection("widget-failing", event -> {
            throw bug;
        });
        runnerWith(failing)
                .run(context -> {
                    PublishedRecord<WidgetEvent> record = record(false);

                    assertThatThrownBy(() -> process(context, failing, record))
                            .isInstanceOf(EventProcessingFailedException.class)
                            .hasMessage("Projection widget-failing failed")
                            .hasCause(bug);
                    assertThat(timerCount(context, "widget-failing", EventProcessingMetrics.OUTCOME_FAILED)).isEqualTo(1);
                });
    }

    @Test
    void aWriteConflict_isAFailureOfItsProjection_notMongoDown() {
        RecordingProjection conflict = new RecordingProjection("widget-conflict", event -> {
            throw new OptimisticLockingFailureException("write conflict");
        });
        runnerWith(conflict)
                .run(context -> {
                    PublishedRecord<WidgetEvent> record = record(false);

                    assertThatThrownBy(() -> process(context, conflict, record))
                            .isInstanceOf(EventProcessingFailedException.class)
                            .hasMessageContaining("widget-conflict");
                    assertThat(timerCount(context, "widget-conflict", EventProcessingMetrics.OUTCOME_FAILED)).isEqualTo(1);
                });
    }

    @Test
    void mongoUnavailable_isRethrown_soTheErrorHandlerRetriesTheRecord() {
        RecordingProjection mongoDown = new RecordingProjection("widget-mongo-down", event -> {
            throw new DataAccessResourceFailureException("Mongo unavailable");
        });
        runnerWith(mongoDown)
                .run(context -> {
                    PublishedRecord<WidgetEvent> record = record(false);

                    assertThatThrownBy(() -> process(context, mongoDown, record))
                            .isInstanceOf(MongoUnavailableException.class)
                            .hasCauseInstanceOf(DataAccessResourceFailureException.class);
                    long mongoUnavailable = timerCount(context, "widget-mongo-down", EventProcessingMetrics.OUTCOME_MONGO_UNAVAILABLE);
                    assertThat(mongoUnavailable).isEqualTo(1);
                });
    }

    @Test
    void aMongoFailover_isMongoDown_evenWhenSpringTranslatesItToAnUncategorizedError() {
        MongoNotPrimaryException notPrimary = new MongoNotPrimaryException(new BsonDocument(), new ServerAddress());
        RecordingProjection failover = new RecordingProjection("widget-failover", event -> {
            throw new UncategorizedMongoDbException("not primary", notPrimary);
        });
        runnerWith(failover)
                .run(context -> {
                    PublishedRecord<WidgetEvent> record = record(false);

                    assertThatThrownBy(() -> process(context, failover, record)).isInstanceOf(MongoUnavailableException.class);
                });
    }

    @Test
    void aProjectionsError_isItsFailure_notABrokenJvm() {
        RecordingProjection overflow = new RecordingProjection("widget-overflow", event -> {
            throw new StackOverflowError("deep");
        });
        runnerWith(overflow)
                .run(context -> {
                    PublishedRecord<WidgetEvent> record = record(false);

                    assertThatThrownBy(() -> process(context, overflow, record))
                            .isInstanceOf(EventProcessingFailedException.class)
                            .hasMessageContaining("widget-overflow")
                            .hasCauseInstanceOf(StackOverflowError.class);
                });
    }

    @Test
    void aSchemaVersionNewerThanThisBuild_isRefused_beforeTheProjectionRuns() {
        runnerWith(onTickets).run(context -> {
            PublishedRecord<WidgetEvent> record = PublishedRecord.<WidgetEvent>builder()
                    .tenantId("tenant-1")
                    .version(3L)
                    .schemaVersion(PublishedRecord.CURRENT_SCHEMA_VERSION + 1)
                    .event(new WidgetEvent())
                    .build();

            assertThatThrownBy(() -> process(context, onTickets, record))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("newer than the supported");
            assertThat(onTickets.records).isEmpty();
        });
    }

    @SafeVarargs
    private static ApplicationContextRunner runnerWith(Projection<WidgetEvent, ?>... projections) {
        List<Projection<WidgetEvent, ?>> specProjections = List.of(projections);
        return new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(EventProcessingAutoConfiguration.class))
                .withUserConfiguration(AggregateSpecRegistry.class)
                .withPropertyValues("openframe.events.enabled=true")
                .withBean(MeterRegistry.class, SimpleMeterRegistry::new)
                .withBean(WidgetSpec.class, () -> new WidgetSpec(specProjections));
    }

    private static void process(AssertableApplicationContext context, Projection<WidgetEvent, ?> projection,
                                PublishedRecord<WidgetEvent> record) {
        ProjectionRunner projectionRunner = context.getBean(ProjectionRunner.class);
        projectionRunner.process(ORGANIZATIONS, projection, "organization-document-1", record);
    }

    private static long timerCount(AssertableApplicationContext context, String projectionName, String outcome) {
        MeterRegistry registry = context.getBean(MeterRegistry.class);
        return registry.get("openframe.events.processing.apply")
                .tag("projection", projectionName)
                .tag("outcome", outcome)
                .timer()
                .count();
    }

    private static PublishedRecord<WidgetEvent> record(boolean deleted) {
        WidgetEvent event = deleted ? null : new WidgetEvent();
        return PublishedRecord.<WidgetEvent>builder()
                .tenantId("tenant-1")
                .version(3L)
                .deleted(deleted)
                .schemaVersion(1)
                .event(event)
                .build();
    }
}
