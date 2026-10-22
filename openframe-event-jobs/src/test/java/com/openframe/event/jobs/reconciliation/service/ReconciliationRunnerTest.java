package com.openframe.event.jobs.reconciliation.service;

import com.openframe.event.jobs.core.persistence.EventJob;
import com.openframe.event.jobs.core.persistence.EventJobStatus;
import com.openframe.event.jobs.core.repository.EventJobRepository;
import com.openframe.event.jobs.core.service.EventJobService;
import com.openframe.event.jobs.core.service.EventJobShutdown;
import com.openframe.event.jobs.core.service.EventJobTicker;
import com.openframe.event.jobs.reconciliation.config.properties.ReconciliationProperties;
import com.openframe.event.jobs.reconciliation.repository.ProjectedItemRepository;
import com.openframe.publishing.api.model.ReconciliationResult;
import com.openframe.publishing.api.model.ReconciliationResult.Mismatch;
import com.openframe.publishing.api.spec.Projection;
import com.openframe.publishing.api.spec.PublishedEvent;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import lombok.AllArgsConstructor;
import lombok.Getter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ReconciliationRunnerTest {

    private static final String NAME = "organization-on-tickets";
    private static final String JOB = "reconciliation:" + NAME;
    private static final Instant NOW = Instant.parse("2026-10-21T03:00:00Z");

    private final ReconciliationProperties properties = new ReconciliationProperties();
    private final ProjectedItemRepository itemRepository = mock(ProjectedItemRepository.class);
    private final EventJobRepository jobRepository = mock(EventJobRepository.class);
    private final SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
    @SuppressWarnings("unchecked")
    private final Projection<PublishedEvent, Item> projection = mock(Projection.class);

    private ReconciliationRunner runner;

    @BeforeEach
    void setUp() {
        properties.setBatchSize(3);
        properties.setPause(Duration.ZERO);
        when(projection.name()).thenReturn(NAME);
        doReturn(ItemDocument.class).when(projection).projectedClass();
        when(projection.projectedViewClass()).thenReturn(Item.class);
        when(projection.reconcile(any())).thenReturn(ReconciliationResult.allMatch());
        when(jobRepository.save(any(EventJob.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(itemRepository.collectionExists(ItemDocument.class)).thenReturn(true);
        when(itemRepository.idOf(any())).thenAnswer(invocation -> invocation.<Item>getArgument(0).getId());
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        EventJobService jobService = new EventJobService(jobRepository, clock);
        EventJobTicker ticker = new EventJobTicker(jobService, new EventJobShutdown(), clock);
        ReconciliationMetrics metrics = new ReconciliationMetrics(meterRegistry, List.of(projection));
        runner = new ReconciliationRunner(properties, itemRepository, jobService, ticker, metrics);
    }

    @Test
    void aMismatch_countsOnlyWhenTheSecondReadConfirmsIt() {
        // setup
        List<Item> batch = List.of(new Item("t1"), new Item("t2"), new Item("t3"));
        List<Item> readAgain = List.of(new Item("t2"), new Item("t3"));
        when(itemRepository.findAfter(ItemDocument.class, Item.class, null, 3)).thenReturn(batch);
        when(itemRepository.findAfter(ItemDocument.class, Item.class, "t3", 3)).thenReturn(List.of());
        when(projection.reconcile(batch)).thenReturn(result(mismatch("t2"), mismatch("t3")));
        when(itemRepository.findByIds(ItemDocument.class, Item.class, List.of("t2", "t3"))).thenReturn(readAgain);
        when(projection.reconcile(readAgain)).thenReturn(result(mismatch("t3")));

        // execution
        runner.checkBatches(projection, running(null));

        // verifications
        EventJob done = lastSaved();
        assertThat(done.getStatus()).isEqualTo(EventJobStatus.DONE);
        assertThat(done.getProcessed()).isEqualTo(3);
        assertThat(done.getLastMismatches()).isEqualTo(1);
    }

    @Test
    void aBatchWithoutMismatches_isNotReadAgain() {
        // setup
        when(itemRepository.findAfter(ItemDocument.class, Item.class, null, 3)).thenReturn(List.of(new Item("t1")));
        when(itemRepository.findAfter(ItemDocument.class, Item.class, "t1", 3)).thenReturn(List.of());

        // execution
        runner.checkBatches(projection, running(null));

        // verifications
        assertThat(lastSaved().getLastMismatches()).isZero();
        verify(itemRepository, never()).findByIds(any(), any(), any());
    }

    @Test
    void theBatches_startAfterTheJobsLastId_andContinueAfterTheLastItem() {
        // setup
        when(itemRepository.findAfter(ItemDocument.class, Item.class, "t9", 3)).thenReturn(List.of(new Item("t10")));
        when(itemRepository.findAfter(ItemDocument.class, Item.class, "t10", 3)).thenReturn(List.of());

        // execution
        runner.checkBatches(projection, running("t9"));

        // verifications
        verify(itemRepository).findAfter(ItemDocument.class, Item.class, "t10", 3);
        assertThat(lastSaved().getStatus()).isEqualTo(EventJobStatus.DONE);
    }

    @Test
    void aRunThatCheckedNothing_stillFinishes_andAsksWhetherTheCollectionExists() {
        // setup
        when(itemRepository.findAfter(ItemDocument.class, Item.class, null, 3)).thenReturn(List.of());
        when(itemRepository.collectionExists(ItemDocument.class)).thenReturn(false);

        // execution
        runner.checkBatches(projection, running(null));

        // verifications
        verify(itemRepository).collectionExists(ItemDocument.class);
        assertThat(lastSaved().getStatus()).isEqualTo(EventJobStatus.DONE);
    }

    @Test
    void maxFailuresInARow_countTheFailedRun() {
        // setup
        EventJob job = running(null);
        job.setFailures(2);
        when(itemRepository.findAfter(ItemDocument.class, Item.class, null, 3)).thenThrow(new IllegalStateException("bad query"));

        // execution
        runner.checkBatches(projection, job);

        // verifications
        assertThat(lastSaved().getStatus()).isEqualTo(EventJobStatus.FAILED);
        assertThat(meterRegistry.counter("openframe.events.reconciliation.failed", "projection", NAME).count()).isEqualTo(1);
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

    private static ReconciliationResult result(Mismatch... mismatches) {
        return new ReconciliationResult(List.of(mismatches));
    }

    private static Mismatch mismatch(String itemId) {
        return new Mismatch("tenant-a", itemId, "name differs");
    }

    // The document whose collection holds the items.
    static class ItemDocument {
    }

    @Getter
    @AllArgsConstructor
    static class Item {
        private final String id;
    }
}
