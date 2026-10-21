package com.openframe.event.jobs.backfill;

import com.openframe.event.jobs.persistence.EventJob;
import com.openframe.event.jobs.persistence.EventJobStatus;
import com.openframe.event.jobs.repository.EventJobRepository;
import com.openframe.event.jobs.service.EventJobService;
import com.openframe.publishing.api.PublishedAggregateType;
import com.openframe.publishing.api.PublishedAggregates;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class EventBackfillServiceTest {

    private static final PublishedAggregateType TYPE = PublishedAggregateType.ORGANIZATIONS;
    private static final String JOB = "backfill:organizations";
    private static final Instant POD_STARTED = Instant.parse("2026-10-21T10:00:00Z");

    private final PublishedAggregates publishedAggregates = mock(PublishedAggregates.class);
    private final EventJobRepository jobRepository = mock(EventJobRepository.class);
    private final EventBackfillRunner runner = mock(EventBackfillRunner.class);

    private EventBackfillService service;

    @BeforeEach
    void setUp() {
        when(publishedAggregates.isPublishing(TYPE)).thenReturn(true);
        when(jobRepository.save(any(EventJob.class))).thenAnswer(invocation -> invocation.getArgument(0));
        Clock clock = Clock.fixed(POD_STARTED, ZoneOffset.UTC);
        EventJobService jobService = new EventJobService(jobRepository, clock);
        service = new EventBackfillService(publishedAggregates, jobService, runner, clock);
    }

    @Test
    void aNewRunId_startsTheRun_fromTheFirstDocument() {
        // setup
        when(jobRepository.findById(JOB)).thenReturn(Optional.empty());

        // execution
        service.backfill(TYPE, "run-1", JOB);

        // verifications
        EventJob started = writtenJob();
        assertThat(started.getRunId()).isEqualTo("run-1");
        assertThat(started.getStatus()).isEqualTo(EventJobStatus.RUNNING);
        assertThat(started.getLastId()).isNull();
    }

    @Test
    void anotherRunId_startsAgain_andRemembersTheReplacedOne() {
        // setup
        when(jobRepository.findById(JOB)).thenReturn(Optional.of(stored("run-1", EventJobStatus.DONE, "z", null)));

        // execution
        service.backfill(TYPE, "run-2", JOB);

        // verifications
        EventJob started = writtenJob();
        assertThat(started.getRunId()).isEqualTo("run-2");
        assertThat(started.getLastId()).isNull();
        assertThat(started.getReplacedRunIds()).containsExactly("run-1");
    }

    @Test
    void aPodWithAReplacedRunId_doesNotStartItAgain() {
        // setup
        EventJob job = stored("run-2", EventJobStatus.RUNNING, "m", null);
        job.setReplacedRunIds(List.of("run-1"));
        when(jobRepository.findById(JOB)).thenReturn(Optional.of(job));

        // execution
        service.backfill(TYPE, "run-1", JOB);

        // verifications
        verifyNoInteractions(runner);
        verify(jobRepository, never()).save(any());
    }

    @Test
    void aRunningRun_continuesAfterItsLastId() {
        // setup
        when(jobRepository.findById(JOB)).thenReturn(Optional.of(stored("run-1", EventJobStatus.RUNNING, "b", null)));

        // execution
        service.backfill(TYPE, "run-1", JOB);

        // verifications
        verify(jobRepository, never()).save(any());
        assertThat(writtenJob().getLastId()).isEqualTo("b");
    }

    @Test
    void aDoneRun_writesNothing() {
        // setup
        when(jobRepository.findById(JOB)).thenReturn(Optional.of(stored("run-1", EventJobStatus.DONE, "z", null)));

        // execution
        service.backfill(TYPE, "run-1", JOB);

        // verifications
        verifyNoInteractions(runner);
    }

    @Test
    void aRunThatFailedBeforeThisPodStarted_isResumedFromItsLastId() {
        // setup
        Instant failedAt = POD_STARTED.minusSeconds(600);
        when(jobRepository.findById(JOB)).thenReturn(Optional.of(stored("run-1", EventJobStatus.FAILED, "b", failedAt)));

        // execution
        service.backfill(TYPE, "run-1", JOB);

        // verifications
        EventJob resumed = writtenJob();
        assertThat(resumed.getStatus()).isEqualTo(EventJobStatus.RUNNING);
        assertThat(resumed.getLastId()).isEqualTo("b");
    }

    @Test
    void aRunThatFailedWhileThisPodRan_staysFailed() {
        // setup
        Instant failedAt = POD_STARTED.plusSeconds(600);
        when(jobRepository.findById(JOB)).thenReturn(Optional.of(stored("run-1", EventJobStatus.FAILED, "b", failedAt)));

        // execution
        service.backfill(TYPE, "run-1", JOB);

        // verifications
        verifyNoInteractions(runner);
        verify(jobRepository, never()).save(any());
    }

    @Test
    void aTypeThatDoesNotPublish_isSkipped() {
        // setup
        when(publishedAggregates.isPublishing(TYPE)).thenReturn(false);

        // execution
        service.backfill(TYPE, "run-1", JOB);

        // verifications
        verifyNoInteractions(jobRepository, runner);
    }

    // Verifies that the runner was called exactly once, and returns the job it got.
    private EventJob writtenJob() {
        ArgumentCaptor<EventJob> job = ArgumentCaptor.forClass(EventJob.class);
        verify(runner).writeBatches(eq(TYPE), job.capture());
        return job.getValue();
    }

    private static EventJob stored(String runId, EventJobStatus status, String lastId, Instant finishedAt) {
        return EventJob.builder().id(JOB).version(1L).runId(runId).status(status).lastId(lastId).finishedAt(finishedAt).build();
    }
}
