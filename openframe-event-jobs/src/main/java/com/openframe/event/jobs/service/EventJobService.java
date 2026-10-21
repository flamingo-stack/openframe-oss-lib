package com.openframe.event.jobs.service;

import com.openframe.event.jobs.persistence.EventJob;
import com.openframe.event.jobs.persistence.EventJobStatus;
import com.openframe.event.jobs.repository.EventJobRepository;
import lombok.RequiredArgsConstructor;

import java.time.Clock;
import java.time.Instant;

// Saves the copies EventJob makes; a save throws OptimisticLockingFailureException when another pod saved a newer one.
@RequiredArgsConstructor
public class EventJobService {

    private final EventJobRepository jobRepository;
    private final Clock clock;

    public EventJob jobOf(String jobId) {
        return jobRepository.findById(jobId).orElseGet(() -> EventJob.neverRun(jobId));
    }

    public EventJob startRun(EventJob job, String runId) {
        Instant now = clock.instant();
        EventJob started = job.startRun(runId, now);
        return jobRepository.save(started);
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
