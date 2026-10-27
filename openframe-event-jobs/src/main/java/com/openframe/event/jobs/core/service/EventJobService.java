package com.openframe.event.jobs.core.service;

import com.openframe.event.jobs.core.persistence.EventJob;
import com.openframe.event.jobs.core.persistence.EventJobStatus;
import com.openframe.event.jobs.core.repository.EventJobRepository;
import lombok.RequiredArgsConstructor;

import java.time.Clock;
import java.time.Instant;

// Saves the copies EventJob makes, one document per run; saving an older copy throws OptimisticLockingFailureException.
@RequiredArgsConstructor
public class EventJobService {

    private final EventJobRepository jobRepository;
    private final Clock clock;

    // The job's newest run, or a job that never ran.
    public EventJob findCurrentRun(String jobId) {
        return jobRepository.findFirstByJobIdOrderByStartedAtDesc(jobId).orElseGet(() -> EventJob.neverRun(jobId));
    }

    public boolean hasRun(String jobId, String runId) {
        return jobRepository.existsByJobIdAndRunId(jobId, runId);
    }

    // A RUNNING newest run ends REPLACED; a second pod inserting the same run gets DuplicateKeyException.
    public EventJob startRun(EventJob newest, String runId) {
        Instant now = clock.instant();
        if (newest.isRunning()) {
            EventJob replaced = newest.finishRun(EventJobStatus.REPLACED, now);
            jobRepository.save(replaced);
        }
        EventJob started = newest.startRun(runId, now);
        return jobRepository.insert(started);
    }

    public EventJob resumeRun(EventJob job) {
        Instant now = clock.instant();
        EventJob resumed = job.resumeRun(now);
        return jobRepository.save(resumed);
    }

    public EventJob saveBatch(EventJob job, String lastId, long rows, long mismatches) {
        Instant now = clock.instant();
        EventJob progressed = job.recordBatch(lastId, rows, mismatches, now);
        return jobRepository.save(progressed);
    }

    public EventJob recordFailure(EventJob job, String error) {
        Instant now = clock.instant();
        EventJob failed = job.recordFailure(error, now);
        return jobRepository.save(failed);
    }

    public EventJob finishRun(EventJob job, EventJobStatus status) {
        Instant now = clock.instant();
        EventJob finished = job.finishRun(status, now);
        return jobRepository.save(finished);
    }
}
