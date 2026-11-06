package com.openframe.event.jobs.reconciliation.service;

import com.openframe.event.jobs.core.persistence.EventJob;
import com.openframe.event.jobs.core.persistence.EventJobStatus;
import com.openframe.event.jobs.core.repository.EventJobRepository;
import com.openframe.event.jobs.core.service.EventJobService;
import com.openframe.event.jobs.reconciliation.config.properties.ReconciliationProperties;
import com.openframe.publishing.api.spec.Projection;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static com.openframe.event.jobs.reconciliation.fixture.Projections.named;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ReconciliationServiceTest {

    private static final String JOB = "reconciliation:organization-on-tickets";
    private static final Instant NOW = Instant.parse("2026-10-21T10:00:00Z");
    private static final Projection<?, ?> TICKETS = named("organization-on-tickets");

    private final EventJobRepository jobRepository = mock(EventJobRepository.class);
    private final ReconciliationRunner runner = mock(ReconciliationRunner.class);
    private final SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();

    private ReconciliationService service;

    @BeforeEach
    void setUp() {
        when(jobRepository.save(any(EventJob.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(jobRepository.insert(any(EventJob.class))).thenAnswer(invocation -> invocation.getArgument(0));
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        EventJobService jobService = new EventJobService(jobRepository, clock);
        ReconciliationMetrics metrics = new ReconciliationMetrics(meterRegistry, List.of(TICKETS));
        service = new ReconciliationService(new ReconciliationProperties(), jobService, runner, metrics, clock);
    }

    @Test
    void theFirstRun_startsAtOnce_forTheBaseline() {
        // setup
        when(jobRepository.findFirstByJobIdOrderByStartedAtDesc(JOB)).thenReturn(Optional.empty());

        // execution
        service.reconcile(TICKETS, JOB);

        // verifications
        EventJob started = checkedJob();
        assertThat(started.getRunId()).isEqualTo(NOW.toString());
        assertThat(started.getLastId()).isNull();
    }

    @Test
    void aRunningRun_continuesAfterItsLastId() {
        // setup
        when(jobRepository.findFirstByJobIdOrderByStartedAtDesc(JOB)).thenReturn(Optional.of(stored(EventJobStatus.RUNNING, "2026-10-21T03:00:00Z")));

        // execution
        service.reconcile(TICKETS, JOB);

        // verifications
        assertThat(checkedJob().getLastId()).isEqualTo("t9");
        verify(jobRepository, never()).save(any());
    }

    @Test
    void aFinishedRun_waitsForTheNextCronFire() {
        // setup
        when(jobRepository.findFirstByJobIdOrderByStartedAtDesc(JOB)).thenReturn(Optional.of(stored(EventJobStatus.DONE, "2026-10-21T03:00:00Z")));

        // execution
        service.reconcile(TICKETS, JOB);

        // verifications
        verifyNoInteractions(runner);
        verify(jobRepository, never()).save(any());
    }

    @Test
    void afterTheCronFired_aNewRunStarts_namedAfterTheFireTime() {
        // setup
        when(jobRepository.findFirstByJobIdOrderByStartedAtDesc(JOB)).thenReturn(Optional.of(stored(EventJobStatus.DONE, "2026-10-20T03:00:00Z")));

        // execution
        service.reconcile(TICKETS, JOB);

        // verifications
        EventJob started = checkedJob();
        assertThat(started.getRunId()).isEqualTo("2026-10-21T03:00:00Z");
        assertThat(started.getLastId()).isNull();
        assertThat(started.getStartedAt()).isEqualTo(NOW);
    }

    @Test
    void aFailedRun_startsAgainAtTheNextCronFire() {
        // setup
        when(jobRepository.findFirstByJobIdOrderByStartedAtDesc(JOB)).thenReturn(Optional.of(stored(EventJobStatus.FAILED, "2026-10-20T03:00:00Z")));

        // execution
        service.reconcile(TICKETS, JOB);

        // verifications
        assertThat(checkedJob().getRunId()).isEqualTo("2026-10-21T03:00:00Z");
    }

    @Test
    void aNewRun_leavesTheFailedRunBeforeItAsItEnded() {
        // setup
        when(jobRepository.findFirstByJobIdOrderByStartedAtDesc(JOB)).thenReturn(Optional.of(stored(EventJobStatus.FAILED, "2026-10-20T03:00:00Z")));

        // execution
        service.reconcile(TICKETS, JOB);

        // verifications
        assertThat(checkedJob().getRunId()).isEqualTo("2026-10-21T03:00:00Z");
        verify(jobRepository, never()).save(any());
    }

    @Test
    void reportLastResult_setsTheGaugeToTheLastFinishedRun() {
        // setup
        EventJob job = stored(EventJobStatus.RUNNING, "2026-10-21T03:00:00Z");
        job.setLastMismatches(7);
        when(jobRepository.findFirstByJobIdOrderByStartedAtDesc(JOB)).thenReturn(Optional.of(job));

        // execution
        service.reportLastResult(TICKETS, JOB);

        // verifications
        assertThat(meterRegistry.get("openframe.events.reconciliation.mismatches").gauge().value()).isEqualTo(7);
    }

    // Verifies that the runner was called exactly once, and returns the job it got.
    private EventJob checkedJob() {
        ArgumentCaptor<EventJob> job = ArgumentCaptor.forClass(EventJob.class);
        verify(runner).checkBatches(eq(TICKETS), job.capture());
        return job.getValue();
    }

    private static EventJob stored(EventJobStatus status, String startedAt) {
        return EventJob.builder().id(JOB + ":run-1").jobId(JOB).version(1L).runId("run-1").status(status).lastId("t9")
                .startedAt(Instant.parse(startedAt)).build();
    }
}
