package com.openframe.event.jobs.backfill.service;

import com.openframe.event.jobs.backfill.config.properties.EventBackfillProperties;
import com.openframe.event.jobs.core.persistence.EventJob;
import com.openframe.event.jobs.core.persistence.EventJobStatus;
import com.openframe.event.jobs.core.repository.EventJobRepository;
import com.openframe.event.jobs.core.service.EventJobService;
import com.openframe.event.jobs.core.service.EventJobShutdown;
import com.openframe.event.jobs.core.service.EventJobTicker;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import com.openframe.publishing.registry.PublishedAggregates;
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
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EventBackfillRunnerTest {

    private static final String TYPE = "organizations";
    private static final String JOB = "backfill:organizations";
    private static final Instant NOW = Instant.parse("2026-10-21T10:00:00Z");

    private final EventBackfillProperties properties = new EventBackfillProperties();
    private final PublishedAggregates publishedAggregates = mock(PublishedAggregates.class);
    private final EventJobRepository jobRepository = mock(EventJobRepository.class);
    private final SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();

    private EventBackfillRunner runner;

    @BeforeEach
    void setUp() {
        properties.setBatchSize(2);
        properties.setPause(Duration.ZERO);
        when(jobRepository.save(any(EventJob.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(publishedAggregates.changedSince(any(), anyMap())).thenReturn(List.of());
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        EventJobService jobService = new EventJobService(jobRepository, clock);
        EventJobTicker<EventJob> ticker = new EventJobTicker<>(jobService, new EventJobShutdown(), clock);
        AggregateSpecRegistry specRegistry = mock(AggregateSpecRegistry.class);
        when(specRegistry.types()).thenReturn(Set.of(TYPE));
        EventBackfillMetrics metrics = new EventBackfillMetrics(meterRegistry, specRegistry);
        runner = new EventBackfillRunner(properties, publishedAggregates, jobService, ticker, metrics);
    }

    @Test
    void everyBatch_isPublishedThenSaved_andTheRunEndsDone() {
        // setup
        when(publishedAggregates.idsAfter(TYPE, null, 2)).thenReturn(List.of("a", "b"));
        when(publishedAggregates.idsAfter(TYPE, "b", 2)).thenReturn(List.of("c"));
        when(publishedAggregates.idsAfter(TYPE, "c", 2)).thenReturn(List.of());

        // execution
        runner.writeBatches(TYPE, running(null));

        // verifications
        verify(publishedAggregates).publishCurrent(TYPE, List.of("a", "b"));
        verify(publishedAggregates).publishCurrent(TYPE, List.of("c"));
        EventJob done = lastSaved();
        assertThat(done.getStatus()).isEqualTo(EventJobStatus.DONE);
        assertThat(done.getLastId()).isEqualTo("c");
        assertThat(done.getProcessed()).isEqualTo(3);
        assertThat(meterRegistry.counter("openframe.events.backfill.documents", "type", "organizations").count()).isEqualTo(3);
    }

    @Test
    void aDocumentWrittenDuringTheBatch_isPublishedAgain_soItsCurrentStateIsLastOnTheTopic() {
        // setup
        Map<String, Long> firstPublish = Map.of("a", 4L, "b", 7L);
        Map<String, Long> secondPublish = Map.of("a", 5L);
        when(publishedAggregates.idsAfter(TYPE, null, 2)).thenReturn(List.of("a", "b"));
        when(publishedAggregates.idsAfter(TYPE, "b", 2)).thenReturn(List.of());
        when(publishedAggregates.publishCurrent(TYPE, List.of("a", "b"))).thenReturn(firstPublish);
        when(publishedAggregates.changedSince(TYPE, firstPublish)).thenReturn(List.of("a"));
        when(publishedAggregates.publishCurrent(TYPE, List.of("a"))).thenReturn(secondPublish);

        // execution
        runner.writeBatches(TYPE, running(null));

        // verifications
        verify(publishedAggregates).publishCurrent(TYPE, List.of("a"));
        verify(publishedAggregates).changedSince(TYPE, secondPublish);
    }

    @Test
    void aDocumentThatKeepsChanging_isLeftToItsOwnWrites_andTheBatchStillSaves() {
        // setup
        when(publishedAggregates.idsAfter(TYPE, null, 2)).thenReturn(List.of("a"));
        when(publishedAggregates.idsAfter(TYPE, "a", 2)).thenReturn(List.of());
        when(publishedAggregates.publishCurrent(any(), any())).thenReturn(Map.of("a", 1L));
        when(publishedAggregates.changedSince(any(), anyMap())).thenReturn(List.of("a"));

        // execution
        runner.writeBatches(TYPE, running(null));

        // verifications
        verify(publishedAggregates, times(6)).publishCurrent(TYPE, List.of("a"));
        assertThat(lastSaved().getStatus()).isEqualTo(EventJobStatus.DONE);
    }

    @Test
    void theBatches_startAfterTheJobsLastId() {
        // setup
        when(publishedAggregates.idsAfter(TYPE, "b", 2)).thenReturn(List.of());

        // execution
        runner.writeBatches(TYPE, running("b"));

        // verifications
        verify(publishedAggregates).idsAfter(TYPE, "b", 2);
        verify(publishedAggregates, never()).publishCurrent(any(), any());
    }

    @Test
    void maxFailuresInARow_countTheFailedRun() {
        // setup
        EventJob job = running("b");
        job.setFailures(2);
        when(publishedAggregates.idsAfter(TYPE, "b", 2)).thenThrow(new IllegalStateException("bad spec"));

        // execution
        runner.writeBatches(TYPE, job);

        // verifications
        assertThat(lastSaved().getStatus()).isEqualTo(EventJobStatus.FAILED);
        assertThat(meterRegistry.counter("openframe.events.backfill.failed", "type", "organizations").count()).isEqualTo(1);
    }

    private EventJob lastSaved() {
        ArgumentCaptor<EventJob> saved = ArgumentCaptor.forClass(EventJob.class);
        verify(jobRepository, atLeastOnce()).save(saved.capture());
        return saved.getValue();
    }

    private static EventJob running(String lastId) {
        EventJob job = EventJob.neverRun(JOB).startRun("run-1", NOW);
        job.setLastId(lastId);
        return job;
    }
}
