package com.openframe.processing.runner;

import com.mongodb.MongoNotPrimaryException;
import com.mongodb.ServerAddress;
import com.openframe.event.jobs.task.service.ProjectionTaskService;
import com.openframe.processing.config.EventProcessingAutoConfiguration;
import com.openframe.processing.exception.EventProcessingFailedException;
import com.openframe.processing.exception.MongoUnavailableException;
import com.openframe.processing.exception.ProjectionConflictException;
import com.openframe.processing.fixture.Widgets.RecordingProjection;
import com.openframe.processing.fixture.Widgets.WidgetEvent;
import com.openframe.processing.fixture.Widgets.WidgetSpec;
import com.openframe.processing.fixture.Transactions;
import com.openframe.processing.version.ProjectionVersionRepository;
import com.openframe.publishing.transaction.MongoTransactionRunner;
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
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// Through EventProcessingAutoConfiguration: real spec registry and metrics; one projection per call, as each has its own listener.
class ProjectionRunnerTest {

    private static final String ORGANIZATIONS = "organizations";
    private static final String ON_TICKETS = "widget-on-tickets";

    private final RecordingProjection onTickets = new RecordingProjection(ON_TICKETS);
    private final ProjectionVersionRepository versions = mock(ProjectionVersionRepository.class);
    private final AtomicBoolean transactionOpen = new AtomicBoolean();
    private final MongoTransactionRunner transactions = Transactions.buildPassThrough(transactionOpen);

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
    void aWriteConflictThatLasts_isRethrown_soTheErrorHandlerRetriesTheRecord() {
        AtomicInteger attempts = new AtomicInteger();
        RecordingProjection conflict = new RecordingProjection("widget-conflict", event -> {
            attempts.incrementAndGet();
            throw new OptimisticLockingFailureException("write conflict");
        });
        runnerWith(conflict)
                .run(context -> {
                    PublishedRecord<WidgetEvent> record = record(false);

                    assertThatThrownBy(() -> process(context, conflict, record)).isInstanceOf(ProjectionConflictException.class);
                    assertThat(attempts).hasValue(5);
                    assertThat(timerCount(context, "widget-conflict", EventProcessingMetrics.OUTCOME_FAILED)).isZero();
                });
    }

    @Test
    void aWriteConflictThatEnds_isRetriedInTheRunner_andTheEventIsApplied() {
        AtomicInteger attempts = new AtomicInteger();
        RecordingProjection conflict = new RecordingProjection("widget-conflict", event -> {
            if (attempts.incrementAndGet() < 3) {
                throw new OptimisticLockingFailureException("write conflict");
            }
        });
        runnerWith(conflict)
                .run(context -> {
                    process(context, conflict, record(false));

                    assertThat(conflict.records).hasSize(1);
                    assertThat(attempts).hasValue(3);
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

    @Test
    void anEventBelowTheInlineLimit_isAppliedInline() {
        onTickets.changes = 4999;
        ProjectionTaskService tasks = mock(ProjectionTaskService.class);
        runnerWith(onTickets).withBean(ProjectionTaskService.class, () -> tasks)
                .run(context -> {
                    process(context, onTickets, record(false));

                    assertThat(onTickets.records).hasSize(1);
                    verify(tasks, never()).submit(any(), any(), any(), any());
                    assertThat(timerCount(context, ON_TICKETS, EventProcessingMetrics.OUTCOME_APPLIED)).isEqualTo(1);
                });
    }

    @Test
    void anEventAtTheInlineLimit_goesToAProjectionTask_insteadOfInline() {
        onTickets.changes = 5000;
        ProjectionTaskService tasks = mock(ProjectionTaskService.class);
        runnerWith(onTickets).withBean(ProjectionTaskService.class, () -> tasks)
                .run(context -> {
                    PublishedRecord<WidgetEvent> record = record(false);
                    process(context, onTickets, record);

                    assertThat(onTickets.records).isEmpty();
                    verify(tasks).submit(ON_TICKETS, ORGANIZATIONS, "organization-document-1", record);
                    assertThat(timerCount(context, ON_TICKETS, EventProcessingMetrics.OUTCOME_HANDED_OVER)).isEqualTo(1);
                });
    }

    @Test
    void whileItsSourceHasATask_evenASmallEventGoesToTheTask() {
        ProjectionTaskService tasks = mock(ProjectionTaskService.class);
        when(tasks.hasTask(ON_TICKETS, "tenant-1", "organization-document-1")).thenReturn(true);
        runnerWith(onTickets).withBean(ProjectionTaskService.class, () -> tasks)
                .run(context -> {
                    process(context, onTickets, record(false));

                    assertThat(onTickets.records).isEmpty();
                    verify(tasks).submit(eq(ON_TICKETS), eq(ORGANIZATIONS), eq("organization-document-1"), any());
                });
    }

    @Test
    void withProjectionTasksOff_aLargeEventIsStillAppliedInline() {
        onTickets.changes = 10000;
        runnerWith(onTickets).run(context -> {
            process(context, onTickets, record(false));

            assertThat(onTickets.records).hasSize(1);
            assertThat(timerCount(context, ON_TICKETS, EventProcessingMetrics.OUTCOME_APPLIED)).isEqualTo(1);
        });
    }

    @Test
    void theInlineLimit_comesFromConfig() {
        onTickets.changes = 5;
        ProjectionTaskService tasks = mock(ProjectionTaskService.class);
        runnerWith(onTickets).withBean(ProjectionTaskService.class, () -> tasks)
                .withPropertyValues("openframe.events.processing.large-updates.inline-limit=5")
                .run(context -> {
                    process(context, onTickets, record(false));

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

    @Test
    void anEventOlderThanTheStoredVersion_isSkipped() {
        when(versions.findStoredVersion(ON_TICKETS, "tenant-1", "organization-document-1")).thenReturn(4L);
        runnerWith(onTickets).run(context -> {
            process(context, onTickets, record(false));

            assertThat(onTickets.records).isEmpty();
            verify(versions, never()).saveVersionIfHigher(any(), any(), any(), anyLong());
            assertThat(timerCount(context, ON_TICKETS, EventProcessingMetrics.OUTCOME_SKIPPED)).isEqualTo(1);
        });
    }

    @Test
    void anEventWithTheStoredVersion_isAppliedAgain_soABackfillRepairsDrift() {
        when(versions.findStoredVersion(ON_TICKETS, "tenant-1", "organization-document-1")).thenReturn(3L);
        runnerWith(onTickets).run(context -> {
            process(context, onTickets, record(false));

            assertThat(onTickets.records).hasSize(1);
            verify(versions).saveVersionIfHigher(ON_TICKETS, "tenant-1", "organization-document-1", 3L);
        });
    }

    @Test
    void aNewerEvent_storesItsVersion_andIsApplied() {
        when(versions.findStoredVersion(ON_TICKETS, "tenant-1", "organization-document-1"))
                .thenReturn(ProjectionVersionRepository.NO_VERSION);
        runnerWith(onTickets).run(context -> {
            process(context, onTickets, record(false));

            assertThat(onTickets.records).hasSize(1);
            verify(versions).saveVersionIfHigher(ON_TICKETS, "tenant-1", "organization-document-1", 3L);
        });
    }

    @Test
    void aFailedApply_throwsInsideItsTransaction_afterTheVersionWrite() {
        RecordingProjection failing = new RecordingProjection("widget-failing", event -> {
            throw new IllegalStateException("bug");
        });
        runnerWith(failing).run(context -> {
            assertThatThrownBy(() -> process(context, failing, record(false))).isInstanceOf(EventProcessingFailedException.class);

            verify(transactions).run(any());
            verify(versions).saveVersionIfHigher("widget-failing", "tenant-1", "organization-document-1", 3L);
        });
    }

    @Test
    void anEventHandedOverToATask_storesItsVersion() {
        onTickets.changes = 5000;
        ProjectionTaskService tasks = mock(ProjectionTaskService.class);
        runnerWith(onTickets).withBean(ProjectionTaskService.class, () -> tasks)
                .run(context -> {
                    process(context, onTickets, record(false));

                    verify(tasks).submit(eq(ON_TICKETS), eq(ORGANIZATIONS), eq("organization-document-1"), any());
                    verify(versions).saveVersionIfHigher(ON_TICKETS, "tenant-1", "organization-document-1", 3L);
                });
    }

    @Test
    void aHandedOverEvent_opensItsTask_onlyAfterTheTransactionCommitted() {
        onTickets.changes = 5000;
        ProjectionTaskService tasks = mock(ProjectionTaskService.class);
        AtomicBoolean submittedInsideTheTransaction = new AtomicBoolean();
        doAnswer(invocation -> {
            submittedInsideTheTransaction.set(transactionOpen.get());
            return null;
        }).when(tasks).submit(any(), any(), any(), any());
        runnerWith(onTickets).withBean(ProjectionTaskService.class, () -> tasks)
                .run(context -> {
                    process(context, onTickets, record(false));

                    verify(tasks).submit(eq(ON_TICKETS), eq(ORGANIZATIONS), eq("organization-document-1"), any());
                    assertThat(submittedInsideTheTransaction).isFalse();
                });
    }

    @Test
    void aNewerVersionStoredBeforeTheHandOver_keepsTheOlderEventFromOpeningATask() {
        onTickets.changes = 5000;
        ProjectionTaskService tasks = mock(ProjectionTaskService.class);
        when(versions.findStoredVersion(ON_TICKETS, "tenant-1", "organization-document-1"))
                .thenReturn(ProjectionVersionRepository.NO_VERSION, 4L);
        runnerWith(onTickets).withBean(ProjectionTaskService.class, () -> tasks)
                .run(context -> {
                    process(context, onTickets, record(false));

                    verify(tasks, never()).submit(any(), any(), any(), any());
                    assertThat(timerCount(context, ON_TICKETS, EventProcessingMetrics.OUTCOME_SKIPPED)).isEqualTo(1);
                });
    }

    @Test
    void aHandOverThatKeepsConflicting_isRetriedLikeAnyConflict() {
        onTickets.changes = 5000;
        ProjectionTaskService tasks = mock(ProjectionTaskService.class);
        doThrow(new OptimisticLockingFailureException("task changed")).when(tasks).submit(any(), any(), any(), any());
        runnerWith(onTickets).withBean(ProjectionTaskService.class, () -> tasks)
                .run(context -> assertThatThrownBy(() -> process(context, onTickets, record(false)))
                        .isInstanceOf(ProjectionConflictException.class));
    }

    @Test
    void anOlderEvent_neverReachesATask() {
        onTickets.changes = 5000;
        ProjectionTaskService tasks = mock(ProjectionTaskService.class);
        when(tasks.hasTask(ON_TICKETS, "tenant-1", "organization-document-1")).thenReturn(true);
        when(versions.findStoredVersion(ON_TICKETS, "tenant-1", "organization-document-1")).thenReturn(4L);
        runnerWith(onTickets).withBean(ProjectionTaskService.class, () -> tasks)
                .run(context -> {
                    process(context, onTickets, record(false));

                    verify(tasks, never()).submit(any(), any(), any(), any());
                });
    }

    @Test
    void aDelete_storesItsVersion_soALateOlderEventIsSkipped() {
        runnerWith(onTickets).run(context -> {
            process(context, onTickets, record(true));

            verify(versions).saveVersionIfHigher(ON_TICKETS, "tenant-1", "organization-document-1", 3L);
            assertThat(timerCount(context, ON_TICKETS, EventProcessingMetrics.OUTCOME_DELETE_STORED)).isEqualTo(1);
        });
    }

    @SafeVarargs
    private ApplicationContextRunner runnerWith(Projection<WidgetEvent, ?>... projections) {
        List<Projection<WidgetEvent, ?>> specProjections = List.of(projections);
        return new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(EventProcessingAutoConfiguration.class))
                .withUserConfiguration(AggregateSpecRegistry.class)
                .withPropertyValues("openframe.events.enabled=true")
                .withBean(MeterRegistry.class, SimpleMeterRegistry::new)
                .withBean(WidgetSpec.class, () -> new WidgetSpec(specProjections))
                .withBean(ProjectionVersionRepository.class, () -> versions)
                .withBean(MongoTransactionRunner.class, () -> transactions);
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
