package com.openframe.event.jobs.reconciliation;

import com.openframe.event.jobs.config.properties.ReconciliationProperties;
import com.openframe.event.jobs.persistence.EventJob;
import com.openframe.event.jobs.persistence.EventJobStatus;
import com.openframe.event.jobs.repository.EventJobRepository;
import com.openframe.event.jobs.repository.ReconciledCopyRepository;
import com.openframe.event.jobs.service.EventJobService;
import com.openframe.event.jobs.service.EventJobShutdown;
import com.openframe.event.jobs.service.EventJobTicker;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ReconciliationRunnerTest {

    private static final String JOB = "reconciliation:tickets.organizationName";
    private static final Instant NOW = Instant.parse("2026-10-21T03:00:00Z");
    private static final MappedCopy TICKETS = MappedCopy.builder()
            .name("tickets.organizationName")
            .targetCollection("tickets").targetReferenceField("organizationId").targetField("organizationName")
            .sourceCollection("organizations").sourceKeyField("organizationId").sourceField("name")
            .build();

    private final ReconciliationProperties properties = new ReconciliationProperties();
    private final ReconciledCopyRepository copyRepository = mock(ReconciledCopyRepository.class);
    private final EventJobRepository jobRepository = mock(EventJobRepository.class);
    private final SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();

    private ReconciliationRunner runner;

    @BeforeEach
    void setUp() {
        properties.setBatchSize(3);
        properties.setPause(Duration.ZERO);
        when(jobRepository.save(any(EventJob.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(copyRepository.targetCollectionExists(any())).thenReturn(true);
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        EventJobService jobService = new EventJobService(jobRepository, clock);
        EventJobTicker ticker = new EventJobTicker(jobService, new EventJobShutdown(), clock);
        ReconciliationMetrics metrics = new ReconciliationMetrics(meterRegistry, List.of(TICKETS));
        runner = new ReconciliationRunner(properties, copyRepository, jobService, ticker, metrics);
    }

    @Test
    void aWrongCopy_andAMissingSource_areMismatches_butARowWithoutReferenceIsNot() {
        // setup
        List<Document> targets = List.of(
                ticket("t1", "tenant-a", "org-1", "Acme"),
                ticket("t2", "tenant-a", "org-2", "Old name"),
                ticket("t3", "tenant-a", "org-gone", "Gone"));
        when(copyRepository.findTargetsAfter(TICKETS, null, 3)).thenReturn(targets);
        when(copyRepository.findTargetsAfter(TICKETS, "t3", 3)).thenReturn(List.of(ticket("t4", "tenant-a", null, null)));
        when(copyRepository.findTargetsAfter(TICKETS, "t4", 3)).thenReturn(List.of());
        when(copyRepository.findSourceValues(any(), any(), any()))
                .thenReturn(Map.of("tenant-a", Map.of("org-1", "Acme", "org-2", "New name")));
        when(copyRepository.findTargetsByIds(TICKETS, List.of("t2", "t3")))
                .thenReturn(List.of(targets.get(1), targets.get(2)));

        // execution
        runner.checkBatches(TICKETS, running(null));

        // verifications
        EventJob done = lastSaved();
        assertThat(done.getProcessed()).isEqualTo(4);
        assertThat(done.getStatus()).isEqualTo(EventJobStatus.DONE);
        assertThat(done.getLastMismatches()).isEqualTo(2);
    }

    @Test
    void aCopyUpdatedBeforeTheSecondRead_isNotCounted() {
        // setup
        Document stale = ticket("t1", "tenant-a", "org-1", "Old name");
        Document updated = ticket("t1", "tenant-a", "org-1", "New name");
        when(copyRepository.findTargetsAfter(TICKETS, null, 3)).thenReturn(List.of(stale));
        when(copyRepository.findTargetsAfter(TICKETS, "t1", 3)).thenReturn(List.of());
        when(copyRepository.findSourceValues(any(), any(), any())).thenReturn(Map.of("tenant-a", Map.of("org-1", "New name")));
        when(copyRepository.findTargetsByIds(TICKETS, List.of("t1"))).thenReturn(List.of(updated));

        // execution
        runner.checkBatches(TICKETS, running(null));

        // verifications
        assertThat(lastSaved().getLastMismatches()).isZero();
    }

    @Test
    void allTenantsOfABatch_areReadInOneQuery_andMatchedWithTheirOwnSources() {
        // setup
        when(copyRepository.findTargetsAfter(TICKETS, null, 3)).thenReturn(List.of(
                ticket("t1", "tenant-a", "org-1", "Acme"),
                ticket("t2", "tenant-b", "org-1", "Acme")));
        when(copyRepository.findTargetsAfter(TICKETS, "t2", 3)).thenReturn(List.of());
        when(copyRepository.findSourceValues(any(), any(), any()))
                .thenReturn(Map.of("tenant-a", Map.of("org-1", "Acme"), "tenant-b", Map.of("org-1", "Other")));
        when(copyRepository.findTargetsByIds(TICKETS, List.of("t2"))).thenReturn(List.of(ticket("t2", "tenant-b", "org-1", "Acme")));

        // execution
        runner.checkBatches(TICKETS, running(null));

        // verifications
        verify(copyRepository).findSourceValues(TICKETS, Set.of("tenant-a", "tenant-b"), Set.of("org-1"));
        assertThat(lastSaved().getLastMismatches()).isEqualTo(1);
    }

    @Test
    void theExpectedCopy_isTheSourceValueThroughTheCopysFunction() {
        // setup
        MappedCopy lowerCase = MappedCopy.builder()
                .name("tickets.organizationName")
                .targetCollection("tickets").targetReferenceField("organizationId").targetField("organizationName")
                .sourceCollection("organizations").sourceKeyField("organizationId").sourceField("name")
                .expectedCopy(value -> value == null ? null : value.toString().toLowerCase())
                .build();
        when(copyRepository.findTargetsAfter(lowerCase, null, 3)).thenReturn(List.of(ticket("t1", "tenant-a", "org-1", "acme")));
        when(copyRepository.findTargetsAfter(lowerCase, "t1", 3)).thenReturn(List.of());
        when(copyRepository.findSourceValues(any(), any(), any())).thenReturn(Map.of("tenant-a", Map.of("org-1", "ACME")));

        // execution
        runner.checkBatches(lowerCase, running(null));

        // verifications
        assertThat(lastSaved().getLastMismatches()).isZero();
        verify(copyRepository, never()).findTargetsByIds(any(), any());
    }

    @Test
    void aSourceWithoutTheField_expectsNoCopy() {
        // setup
        Map<String, Object> sourceWithoutName = new HashMap<>();
        sourceWithoutName.put("org-1", null);
        when(copyRepository.findTargetsAfter(TICKETS, null, 3)).thenReturn(List.of(ticket("t1", "tenant-a", "org-1", null)));
        when(copyRepository.findTargetsAfter(TICKETS, "t1", 3)).thenReturn(List.of());
        when(copyRepository.findSourceValues(any(), any(), any())).thenReturn(Map.of("tenant-a", sourceWithoutName));

        // execution
        runner.checkBatches(TICKETS, running(null));

        // verifications
        assertThat(lastSaved().getLastMismatches()).isZero();
    }

    @Test
    void aRunThatCheckedNothing_stillFinishes_andAsksWhetherTheTargetExists() {
        // setup
        when(copyRepository.findTargetsAfter(TICKETS, null, 3)).thenReturn(List.of());
        when(copyRepository.targetCollectionExists(TICKETS)).thenReturn(false);

        // execution
        runner.checkBatches(TICKETS, running(null));

        // verifications
        verify(copyRepository).targetCollectionExists(TICKETS);
        assertThat(lastSaved().getStatus()).isEqualTo(EventJobStatus.DONE);
    }

    @Test
    void theBatches_startAfterTheJobsLastId() {
        // setup
        when(copyRepository.findTargetsAfter(TICKETS, "t9", 3)).thenReturn(List.of());

        // execution
        runner.checkBatches(TICKETS, running("t9"));

        // verifications
        verify(copyRepository).findTargetsAfter(TICKETS, "t9", 3);
    }

    @Test
    void maxFailuresInARow_countTheFailedRun() {
        // setup
        EventJob job = running(null);
        job.setFailures(2);
        when(copyRepository.findTargetsAfter(TICKETS, null, 3)).thenThrow(new IllegalStateException("bad field"));

        // execution
        runner.checkBatches(TICKETS, job);

        // verifications
        assertThat(lastSaved().getStatus()).isEqualTo(EventJobStatus.FAILED);
        assertThat(meterRegistry.counter("openframe.events.reconciliation.failed", "copy", "tickets.organizationName").count())
                .isEqualTo(1);
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

    private static Document ticket(String id, String tenantId, String organizationId, String organizationName) {
        Document ticket = new Document("_id", id).append("tenantId", tenantId);
        if (organizationId != null) {
            ticket.append("organizationId", organizationId);
        }
        if (organizationName != null) {
            ticket.append("organizationName", organizationName);
        }
        return ticket;
    }
}
