package com.openframe.processing.runner;

import com.mongodb.MongoNotPrimaryException;
import com.mongodb.ServerAddress;
import com.openframe.event.jobs.task.service.ProjectionTaskService;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// Through EventProcessingAutoConfiguration: real spec registry, modes and metrics; projections that record what reached them.
class ProjectionRunnerTest {

    private static final String ORGANIZATIONS = "organizations";
    private static final String ON_TICKETS = "widget-on-tickets";
    private static final String ON_INDEX = "widget-on-index";

    private final RecordingProjection onTickets = new RecordingProjection(ON_TICKETS);
    private final RecordingProjection onIndex = new RecordingProjection(ON_INDEX);

    @Test
    void anEvent_reachesEveryProjectionOnEvents_withTheEnvelopesTenantAndVersion() {
        runnerWith(onTickets, onIndex).withPropertyValues(onEvents(ON_TICKETS), onEvents(ON_INDEX)).run(context -> {
            process(context, record(false));

            assertThat(onTickets.records).singleElement().satisfies(applied -> {
                assertThat(applied.getTenantId()).isEqualTo("tenant-1");
                assertThat(applied.getVersion()).isEqualTo(3L);
            });
            assertThat(onIndex.records).hasSize(1);
        });
    }

    @Test
    void aProjectionOnAspect_isSkipped() {
        runnerWith(onTickets, onIndex).withPropertyValues(onEvents(ON_TICKETS)).run(context -> {
            process(context, record(false));

            assertThat(onTickets.records).hasSize(1);
            assertThat(onIndex.records).isEmpty();
        });
    }

    @Test
    void aProjectionOnBoth_runs() {
        runnerWith(onTickets).withPropertyValues("openframe.events.processing.projections." + ON_TICKETS + ".mode=both")
                .run(context -> {
                    process(context, record(false));

                    assertThat(onTickets.records).hasSize(1);
                });
    }

    @Test
    void aDelete_reachesNoProjection() {
        runnerWith(onTickets, onIndex).withPropertyValues(onEvents(ON_TICKETS), onEvents(ON_INDEX)).run(context -> {
            process(context, record(true));

            assertThat(onTickets.records).isEmpty();
            assertThat(onIndex.records).isEmpty();
        });
    }

    @Test
    void aFailingProjection_doesNotStopTheOthers_andIsNamedInTheExceptionAfterwards() {
        RecordingProjection failing = new RecordingProjection("widget-failing", event -> {
            throw new IllegalStateException("bug");
        });
        runnerWith(onTickets, onIndex, failing)
                .withPropertyValues(onEvents(ON_TICKETS), onEvents(ON_INDEX), onEvents("widget-failing"))
                .run(context -> {
                    PublishedRecord<WidgetEvent> record = record(false);

                    assertThatThrownBy(() -> process(context, record))
                            .isInstanceOf(EventProcessingFailedException.class)
                            .hasMessageContaining("[widget-failing]");
                    assertThat(onTickets.records).hasSize(1);
                    assertThat(onIndex.records).hasSize(1);
                    assertThat(timerCount(context, "widget-failing", EventProcessingMetrics.OUTCOME_FAILED)).isEqualTo(1);
                    assertThat(timerCount(context, ON_TICKETS, EventProcessingMetrics.OUTCOME_APPLIED)).isEqualTo(1);
                });
    }

    @Test
    void twoFailingProjections_areBothNamed_andBothStackTracesAreKept() {
        IllegalStateException first = new IllegalStateException("first bug");
        IllegalStateException second = new IllegalStateException("second bug");
        RecordingProjection failingFirst = new RecordingProjection("widget-first", event -> {
            throw first;
        });
        RecordingProjection failingSecond = new RecordingProjection("widget-second", event -> {
            throw second;
        });
        runnerWith(failingFirst, failingSecond)
                .withPropertyValues(onEvents("widget-first"), onEvents("widget-second"))
                .run(context -> {
                    PublishedRecord<WidgetEvent> record = record(false);

                    assertThatThrownBy(() -> process(context, record))
                            .isInstanceOf(EventProcessingFailedException.class)
                            .hasMessageContaining("widget-first")
                            .hasMessageContaining("widget-second")
                            .satisfies(failure -> {
                                Throwable[] suppressed = failure.getSuppressed();
                                Throwable cause = failure.getCause();
                                assertThat(List.of(cause, suppressed[0])).containsExactlyInAnyOrder(first, second);
                            });
                });
    }

    @Test
    void aWriteConflict_isAFailureOfItsProjection_notMongoDown() {
        RecordingProjection conflict = new RecordingProjection("widget-conflict", event -> {
            throw new OptimisticLockingFailureException("write conflict");
        });
        runnerWith(onTickets, conflict)
                .withPropertyValues(onEvents(ON_TICKETS), onEvents("widget-conflict"))
                .run(context -> {
                    PublishedRecord<WidgetEvent> record = record(false);

                    assertThatThrownBy(() -> process(context, record))
                            .isInstanceOf(EventProcessingFailedException.class)
                            .hasMessageContaining("[widget-conflict]");
                    assertThat(onTickets.records).hasSize(1);
                    assertThat(timerCount(context, "widget-conflict", EventProcessingMetrics.OUTCOME_FAILED)).isEqualTo(1);
                });
    }

    @Test
    void mongoUnavailable_isRethrownForTheWholeEvent() {
        RecordingProjection mongoDown = new RecordingProjection("widget-mongo-down", event -> {
            throw new DataAccessResourceFailureException("Mongo unavailable");
        });
        runnerWith(mongoDown)
                .withPropertyValues(onEvents("widget-mongo-down"))
                .run(context -> {
                    PublishedRecord<WidgetEvent> record = record(false);

                    assertThatThrownBy(() -> process(context, record))
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
                .withPropertyValues(onEvents("widget-failover"))
                .run(context -> {
                    PublishedRecord<WidgetEvent> record = record(false);

                    assertThatThrownBy(() -> process(context, record)).isInstanceOf(MongoUnavailableException.class);
                });
    }

    @Test
    void aProjectionsError_isItsFailure_andTheOthersStillRun() {
        RecordingProjection overflow = new RecordingProjection("widget-overflow", event -> {
            throw new StackOverflowError("deep");
        });
        runnerWith(onTickets, overflow)
                .withPropertyValues(onEvents(ON_TICKETS), onEvents("widget-overflow"))
                .run(context -> {
                    PublishedRecord<WidgetEvent> record = record(false);

                    assertThatThrownBy(() -> process(context, record))
                            .isInstanceOf(EventProcessingFailedException.class)
                            .hasMessageContaining("[widget-overflow]")
                            .hasCauseInstanceOf(StackOverflowError.class);
                    assertThat(onTickets.records).hasSize(1);
                });
    }

    @Test
    void aSchemaVersionNewerThanThisBuild_isRefused_beforeAnyProjectionRuns() {
        runnerWith(onTickets).withPropertyValues(onEvents(ON_TICKETS)).run(context -> {
            PublishedRecord<WidgetEvent> record = PublishedRecord.<WidgetEvent>builder()
                    .tenantId("tenant-1")
                    .version(3L)
                    .schemaVersion(PublishedRecord.CURRENT_SCHEMA_VERSION + 1)
                    .event(new WidgetEvent())
                    .build();

            assertThatThrownBy(() -> process(context, record))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("newer than the supported");
            assertThat(onTickets.records).isEmpty();
        });
    }

    @Test
    void theProjectionsRunInNameOrder_soTheFirstFailureIsTheSameOnEveryPod() {
        IllegalStateException alpha = new IllegalStateException("alpha");
        IllegalStateException zulu = new IllegalStateException("zulu");
        RecordingProjection zuluProjection = new RecordingProjection("widget-zulu", event -> {
            throw zulu;
        });
        RecordingProjection alphaProjection = new RecordingProjection("widget-alpha", event -> {
            throw alpha;
        });
        runnerWith(zuluProjection, alphaProjection)
                .withPropertyValues(onEvents("widget-zulu"), onEvents("widget-alpha"))
                .run(context -> {
                    PublishedRecord<WidgetEvent> record = record(false);

                    assertThatThrownBy(() -> process(context, record))
                            .hasMessageContaining("[widget-alpha, widget-zulu]")
                            .hasCause(alpha);
                });
    }

    @Test
    void anEventBelowTheInlineLimit_isAppliedInline() {
        onTickets.changes = 4999;
        ProjectionTaskService tasks = mock(ProjectionTaskService.class);
        runnerWith(onTickets).withBean(ProjectionTaskService.class, () -> tasks).withPropertyValues(onEvents(ON_TICKETS))
                .run(context -> {
                    process(context, record(false));

                    assertThat(onTickets.records).hasSize(1);
                    verify(tasks, never()).submit(any(), any(), any(), any());
                    assertThat(timerCount(context, ON_TICKETS, EventProcessingMetrics.OUTCOME_APPLIED)).isEqualTo(1);
                });
    }

    @Test
    void anEventAtTheInlineLimit_goesToAProjectionTask_insteadOfInline() {
        onTickets.changes = 5000;
        ProjectionTaskService tasks = mock(ProjectionTaskService.class);
        runnerWith(onTickets).withBean(ProjectionTaskService.class, () -> tasks).withPropertyValues(onEvents(ON_TICKETS))
                .run(context -> {
                    PublishedRecord<WidgetEvent> record = record(false);
                    process(context, record);

                    assertThat(onTickets.records).isEmpty();
                    verify(tasks).submit(ON_TICKETS, ORGANIZATIONS, "organization-document-1", record);
                    assertThat(timerCount(context, ON_TICKETS, EventProcessingMetrics.OUTCOME_HANDED_OVER)).isEqualTo(1);
                });
    }

    @Test
    void whileItsSourceHasATask_evenASmallEventGoesToTheTask() {
        ProjectionTaskService tasks = mock(ProjectionTaskService.class);
        when(tasks.hasTask(ON_TICKETS, "tenant-1", "organization-document-1")).thenReturn(true);
        runnerWith(onTickets).withBean(ProjectionTaskService.class, () -> tasks).withPropertyValues(onEvents(ON_TICKETS))
                .run(context -> {
                    process(context, record(false));

                    assertThat(onTickets.records).isEmpty();
                    verify(tasks).submit(eq(ON_TICKETS), eq(ORGANIZATIONS), eq("organization-document-1"), any());
                });
    }

    @Test
    void withProjectionTasksOff_aLargeEventIsStillAppliedInline() {
        onTickets.changes = 10000;
        runnerWith(onTickets).withPropertyValues(onEvents(ON_TICKETS)).run(context -> {
            process(context, record(false));

            assertThat(onTickets.records).hasSize(1);
            assertThat(timerCount(context, ON_TICKETS, EventProcessingMetrics.OUTCOME_APPLIED)).isEqualTo(1);
        });
    }

    @Test
    void theInlineLimit_comesFromConfig() {
        onTickets.changes = 5;
        ProjectionTaskService tasks = mock(ProjectionTaskService.class);
        runnerWith(onTickets).withBean(ProjectionTaskService.class, () -> tasks)
                .withPropertyValues(onEvents(ON_TICKETS), "openframe.events.processing.large-updates.inline-limit=5")
                .run(context -> {
                    process(context, record(false));

                    verify(tasks).submit(eq(ON_TICKETS), eq(ORGANIZATIONS), eq("organization-document-1"), any());
                });
    }

    @Test
    void anInlineLimitBelowOne_stopsTheService() {
        runnerWith(onTickets).withPropertyValues("openframe.events.processing.large-updates.inline-limit=0")
                .run(context -> assertThat(context).hasFailed()
                        .getFailure().hasStackTraceContaining("openframe.events.processing.large-updates")
                        .hasStackTraceContaining("inlineLimit"));
    }

    @SafeVarargs
    private static ApplicationContextRunner runnerWith(Projection<WidgetEvent, ?>... projections) {
        List<Projection<WidgetEvent, ?>> specProjections = List.of(projections);
        return new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(EventProcessingAutoConfiguration.class))
                .withUserConfiguration(AggregateSpecRegistry.class)
                .withPropertyValues("openframe.events.processing.enabled=true")
                .withBean(MeterRegistry.class, SimpleMeterRegistry::new)
                .withBean(WidgetSpec.class, () -> new WidgetSpec(specProjections));
    }

    private void process(AssertableApplicationContext context, PublishedRecord<WidgetEvent> record) {
        ProjectionRunner projectionRunner = context.getBean(ProjectionRunner.class);
        projectionRunner.process(ORGANIZATIONS, "organization-document-1", record);
    }

    private static long timerCount(AssertableApplicationContext context, String projectionName, String outcome) {
        MeterRegistry registry = context.getBean(MeterRegistry.class);
        return registry.get("openframe.events.processing.apply")
                .tag("projection", projectionName)
                .tag("outcome", outcome)
                .timer()
                .count();
    }

    private static String onEvents(String projectionName) {
        return "openframe.events.processing.projections." + projectionName + ".mode=events";
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
