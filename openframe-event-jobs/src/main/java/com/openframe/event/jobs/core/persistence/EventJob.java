package com.openframe.event.jobs.core.persistence;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

// The progress of one job, for every tenant at once, so not TenantScoped; ShedLock, not this document, keeps it on one pod.
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "event_jobs")
public class EventJob {

    private static final int MAX_REPLACED_RUN_IDS = 10;

    // The job's key, for example backfill:organizations.
    @Id
    private String id;

    // A pod still busy with an older copy of the job fails its save instead of overwriting a newer run.
    @Version
    private Long version;

    private String runId;
    private EventJobStatus status;

    // The last _id done; saved only after its batch is written, so a crash repeats at most one batch.
    private String lastId;
    private long processed;
    // Reconciliation only: the rows that differ in the current run, and the total of the last finished one (the metric).
    private long mismatches;
    private long lastMismatches;
    // Failures in a row of the current run; a saved batch resets it.
    private int failures;
    private String lastError;

    // The run ids this job had before: a pod that still has one of them in its config does not start it again.
    private List<String> replacedRunIds;

    private Instant startedAt;
    private Instant updatedAt;
    private Instant finishedAt;

    // A job that never ran: no status, so no run id matches it.
    public static EventJob neverRun(String id) {
        return EventJob.builder().id(id).build();
    }

    public boolean isRunOf(String otherRunId) {
        return status != null && otherRunId.equals(runId);
    }

    public boolean wasReplaced(String otherRunId) {
        return replacedRunIds != null && replacedRunIds.contains(otherRunId);
    }

    // Every change returns a copy; a new run keeps lastMismatches, the metric, until it finishes.
    public EventJob startRun(String newRunId, Instant now) {
        List<String> replaced = replacedWith(newRunId);
        return toBuilder()
                .runId(newRunId)
                .replacedRunIds(replaced)
                .status(EventJobStatus.RUNNING)
                .lastId(null)
                .processed(0)
                .mismatches(0)
                .failures(0)
                .lastError(null)
                .startedAt(now)
                .updatedAt(now)
                .finishedAt(null)
                .build();
    }

    // The last few only: reconciliation starts a run every night.
    private List<String> replacedWith(String newRunId) {
        List<String> replaced = replacedRunIds == null ? new ArrayList<>() : new ArrayList<>(replacedRunIds);
        if (runId != null && !runId.equals(newRunId)) {
            replaced.add(runId);
        }
        int count = replaced.size();
        int from = Math.max(0, count - MAX_REPLACED_RUN_IDS);
        List<String> lastFew = replaced.subList(from, count);
        return new ArrayList<>(lastFew);
    }

    public EventJob resumeRun(Instant now) {
        return toBuilder()
                .status(EventJobStatus.RUNNING)
                .failures(0)
                .lastError(null)
                .updatedAt(now)
                .finishedAt(null)
                .build();
    }

    public EventJob recordBatch(String batchLastId, long rows, long rowMismatches, Instant now) {
        return toBuilder()
                .lastId(batchLastId)
                .processed(processed + rows)
                .mismatches(mismatches + rowMismatches)
                .failures(0)
                .updatedAt(now)
                .build();
    }

    public EventJob recordFailure(String error, Instant now) {
        return toBuilder()
                .failures(failures + 1)
                .lastError(error)
                .updatedAt(now)
                .build();
    }

    public EventJob finishRun(EventJobStatus finalStatus, Instant now) {
        EventJobBuilder finished = toBuilder()
                .status(finalStatus)
                .updatedAt(now)
                .finishedAt(now);
        if (finalStatus == EventJobStatus.DONE) {
            finished.lastError(null).lastMismatches(mismatches);
        }
        return finished.build();
    }
}
