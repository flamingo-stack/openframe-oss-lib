package com.openframe.event.jobs.core.service;

import com.openframe.event.jobs.core.persistence.EventJobStatus;
import com.openframe.publishing.api.util.MongoUnavailability;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.OptimisticLockingFailureException;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

// One tick of a run or a task: batches until the run is done, half the lock time is over or the service stops.
@Slf4j
@RequiredArgsConstructor
public class EventJobTicker<J extends EventJobProgress> {

    private final EventJobProgressStore<J> progressStore;
    private final EventJobShutdown shutdown;
    private final Clock clock;

    // onFailed runs when maxFailures in a row set the run FAILED; the job's metric counts it there.
    public void tick(String jobName, J job, EventJobSettings settings, EventJobBatch<J> batch, Runnable onFailed) {
        Duration lockAtMostFor = settings.getLockAtMostFor();
        Duration tickLength = lockAtMostFor.dividedBy(2);
        Instant tickEnd = clock.instant().plus(tickLength);
        J current = job;
        try {
            while (clock.instant().isBefore(tickEnd) && !shutdown.isStopping()) {
                current = batch.next(current);
                if (current.getStatus() != EventJobStatus.RUNNING) {
                    return;
                }
                Duration pause = settings.getPause();
                pause(pause);
            }
            log.debug("{} continues at the next tick, run {}, after {}", jobName, current.getRunId(), current.getLastId());
        } catch (OptimisticLockingFailureException newerCopy) {
            log.warn("{} stopped: another pod saved a newer copy of run {}", jobName, current.getRunId());
        } catch (RuntimeException failure) {
            handleFailure(jobName, current, settings, failure, onFailed);
        }
    }

    // Mongo down waits for the next tick without counting; any other error counts, and maxFailures in a row stop the run.
    private void handleFailure(String jobName, J job, EventJobSettings settings, RuntimeException failure,
                               Runnable onFailed) {
        if (MongoUnavailability.isMongoUnavailable(failure)) {
            log.warn("{} waits for Mongo, run {}, after {}: {}", jobName, job.getRunId(), job.getLastId(), failure.toString());
            return;
        }
        String error = failure.toString();
        J failed = progressStore.recordFailure(job, error);
        if (failed.getFailures() < settings.getMaxFailures()) {
            log.warn("{} failed ({} in a row), run {}, after {}; the next tick tries again",
                    jobName, failed.getFailures(), job.getRunId(), job.getLastId(), failure);
            return;
        }
        progressStore.finishRun(failed, EventJobStatus.FAILED);
        onFailed.run();
        log.error("{} FAILED after {} failures in a row, run {}, after {}", jobName, failed.getFailures(), job.getRunId(),
                job.getLastId(), failure);
    }

    private static void pause(Duration pause) {
        try {
            Thread.sleep(pause);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
        }
    }
}
