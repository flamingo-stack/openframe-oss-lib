package com.openframe.event.jobs.core.persistence;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldNameConstants;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

// One run of a job, for every tenant at once, so not TenantScoped; ShedLock, not this document, keeps the job on one pod.
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
@FieldNameConstants
@Document(collection = "event_job_runs")
public class EventJob {

    // <jobId>:<runId>, so a second pod that starts the same run fails its insert.
    @Id
    private String id;

    // The job's key, for example backfill:organizations; the job's current run is its newest by startedAt.
    private String jobId;

    // A pod still busy with an older copy of the run fails its save instead of overwriting a newer one.
    @Version
    private Long version;

    private String runId;
    private EventJobStatus status;

    // The last _id done; saved only after its batch is written, so a crash repeats at most one batch.
    private String lastId;
    private long processed;
    // Reconciliation only: the rows that differ in this run, and the total of the last finished one (the metric).
    private long mismatches;
    private long lastMismatches;
    // Failures in a row of this run; a saved batch resets it.
    private int failures;
    private String lastError;

    private Instant startedAt;
    private Instant updatedAt;
    private Instant finishedAt;

    // A job that never ran: no status, so no run id matches it.
    public static EventJob neverRun(String jobId) {
        return EventJob.builder().jobId(jobId).build();
    }

    public boolean hasRunId(String otherRunId) {
        return status != null && otherRunId.equals(runId);
    }

    public boolean isRunning() {
        return status == EventJobStatus.RUNNING;
    }

    // A new document for the new run; it keeps lastMismatches, the metric, until it finishes.
    public EventJob startRun(String newRunId, Instant now) {
        String newId = jobId + ":" + newRunId;
        return toBuilder()
                .id(newId)
                .version(null)
                .runId(newRunId)
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
