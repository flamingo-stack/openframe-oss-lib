package com.openframe.event.jobs.task.service;

import com.openframe.event.jobs.core.persistence.EventJobStatus;
import com.openframe.event.jobs.core.service.EventJobShutdown;
import com.openframe.event.jobs.core.service.EventJobTicker;
import com.openframe.event.jobs.task.config.properties.ProjectionTaskProperties;
import com.openframe.event.jobs.task.fixture.Widgets;
import com.openframe.event.jobs.task.fixture.Widgets.WidgetEvent;
import com.openframe.event.jobs.task.persistence.ProjectionTask;
import com.openframe.event.jobs.task.repository.ProjectionTaskRepository;
import com.openframe.publishing.api.model.PublishedRecord;
import com.openframe.publishing.api.spec.Projection;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static com.openframe.event.jobs.task.fixture.Widgets.record;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ProjectionTaskRunnerTest {

    private static final String PROJECTION = "widget-copies";
    private static final String TASK_ID = "widget-copies:tenant-a:widget-doc-1";
    private static final Instant NOW = Instant.parse("2026-10-22T10:00:00Z");

    private final ProjectionTaskProperties properties = new ProjectionTaskProperties();
    private final ProjectionTaskRepository taskRepository = mock(ProjectionTaskRepository.class);
    private final SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
    @SuppressWarnings("unchecked")
    private final Projection<WidgetEvent, Object> projection = mock(Projection.class);

    private ProjectionTaskEnvelopes envelopes;
    private ProjectionTaskRunner runner;

    @BeforeEach
    void setUp() {
        properties.setBatchSize(2);
        properties.setPause(Duration.ZERO);
        when(projection.name()).thenReturn(PROJECTION);
        when(taskRepository.save(any(ProjectionTask.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(taskRepository.deleteByIdAndVersion(anyString(), any())).thenReturn(1L);
        AggregateSpecRegistry specRegistry = Widgets.registryWith(projection);
        envelopes = new ProjectionTaskEnvelopes(specRegistry);
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        ProjectionTaskService taskService = new ProjectionTaskService(taskRepository, envelopes, clock);
        EventJobTicker<ProjectionTask> ticker = new EventJobTicker<>(taskService, new EventJobShutdown(), clock);
        ProjectionTaskMetrics metrics = new ProjectionTaskMetrics(meterRegistry, List.of(projection));
        List<Projection<?, ?>> projections = List.of(projection);
        runner = new ProjectionTaskRunner(properties, projections, taskService, envelopes, ticker, metrics);
    }

    @Test
    void theBatches_runInIdOrder_eachSaved_untilNoneIsLeft_thenTheTaskIsDeleted() {
        // setup
        storedTask(task(PROJECTION));
        when(projection.applyBatch(any(), isNull(), eq(2))).thenReturn("w2");
        when(projection.applyBatch(any(), eq("w2"), eq(2))).thenReturn("w4");
        when(projection.applyBatch(any(), eq("w4"), eq(2))).thenReturn(null);

        // execution
        runner.applyBatches(TASK_ID);

        // verifications
        ArgumentCaptor<ProjectionTask> saved = ArgumentCaptor.forClass(ProjectionTask.class);
        verify(taskRepository, atLeastOnce()).save(saved.capture());
        assertThat(saved.getAllValues()).extracting(ProjectionTask::getLastId).containsExactly("w2", "w4");
        verify(taskRepository).deleteByIdAndVersion(TASK_ID, 3L);
    }

    @Test
    void eachBatch_getsTheEventOfTheTask_inTheSpecsEventClass() {
        // setup
        storedTask(task(PROJECTION));
        when(projection.applyBatch(any(), isNull(), anyInt())).thenReturn(null);

        // execution
        runner.applyBatches(TASK_ID);

        // verifications
        @SuppressWarnings("unchecked")
        ArgumentCaptor<PublishedRecord<WidgetEvent>> record = ArgumentCaptor.forClass(PublishedRecord.class);
        verify(projection).applyBatch(record.capture(), isNull(), eq(2));
        assertThat(record.getValue().getTenantId()).isEqualTo("tenant-a");
        assertThat(record.getValue().getEvent().getName()).isEqualTo("New name");
    }

    @Test
    void aTaskThatIsGoneOrFailed_isNotApplied() {
        // setup
        when(taskRepository.findById(TASK_ID)).thenReturn(Optional.empty());
        ProjectionTask failed = task(PROJECTION).finish(EventJobStatus.FAILED, NOW);
        when(taskRepository.findById("widget-copies:tenant-a:failed")).thenReturn(Optional.of(failed));

        // execution
        runner.applyBatches(TASK_ID);
        runner.applyBatches("widget-copies:tenant-a:failed");

        // verifications
        verify(projection, never()).applyBatch(any(), any(), anyInt());
    }

    @Test
    void aTaskOfAProjectionThisServiceDoesNotHave_isLeftAsItIs() {
        // setup
        storedTask(task("unknown-projection"));

        // execution
        runner.applyBatches(TASK_ID);

        // verifications
        verify(projection, never()).applyBatch(any(), any(), anyInt());
        verify(taskRepository, never()).save(any());
    }

    @Test
    void theThirdFailureInARow_setsTheTaskFailed_andCountsIt() {
        // setup
        ProjectionTask task = task(PROJECTION);
        storedTask(task);
        when(projection.applyBatch(any(), any(), anyInt())).thenThrow(new IllegalStateException("bad write"));
        when(taskRepository.save(any(ProjectionTask.class))).thenAnswer(invocation -> {
            ProjectionTask saved = invocation.getArgument(0);
            storedTask(saved);
            return saved;
        });

        // execution
        runner.applyBatches(TASK_ID);
        runner.applyBatches(TASK_ID);
        runner.applyBatches(TASK_ID);

        // verifications
        ProjectionTask stored = taskRepository.findById(TASK_ID).orElseThrow();
        assertThat(stored.getStatus()).isEqualTo(EventJobStatus.FAILED);
        assertThat(stored.getFailures()).isEqualTo(3);
        double failed = meterRegistry.get("openframe.events.projection.tasks.failed").tag("projection", PROJECTION).counter()
                .count();
        assertThat(failed).isEqualTo(1.0);
    }

    @Test
    void theOpenTasks_andTheOldestOnesAge_areReported() {
        // setup
        when(taskRepository.countByProjectionAndStatus(PROJECTION, EventJobStatus.RUNNING)).thenReturn(2L);
        ProjectionTask oldest = task(PROJECTION).toBuilder().startedAt(NOW.minusSeconds(600)).build();
        when(taskRepository.findFirstByProjectionAndStatusOrderByStartedAtAsc(PROJECTION, EventJobStatus.RUNNING))
                .thenReturn(Optional.of(oldest));

        // execution
        runner.reportOpenTasks(projection);

        // verifications
        assertThat(meterRegistry.get("openframe.events.projection.tasks.open").tag("projection", PROJECTION).gauge().value())
                .isEqualTo(2.0);
        assertThat(meterRegistry.get("openframe.events.projection.tasks.oldest.age").tag("projection", PROJECTION).gauge()
                .value()).isEqualTo(600.0);
    }

    private void storedTask(ProjectionTask task) {
        when(taskRepository.findById(TASK_ID)).thenReturn(Optional.of(task));
    }

    private ProjectionTask task(String projectionName) {
        PublishedRecord<WidgetEvent> record = record("tenant-a", 4, "New name", NOW);
        Map<String, Object> envelope = envelopes.envelopeOf(record);
        ProjectionTask opened = ProjectionTask.open(projectionName, Widgets.TYPE, "tenant-a", "widget-doc-1", envelope, 4, NOW);
        return opened.toBuilder().id(TASK_ID).version(3L).build();
    }
}
