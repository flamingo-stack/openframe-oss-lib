package com.openframe.event.jobs.task.persistence;

import com.openframe.event.jobs.core.persistence.EventJobStatus;
import com.openframe.event.jobs.core.service.EventJobProgress;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldNameConstants;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.Map;

// One run of a large update of a projection, for one source document; kept when it ends, as the tasks' history. Every
// tenant's, so not TenantScoped.
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
@FieldNameConstants
@Document(collection = "event_projection_tasks")
public class ProjectionTask implements EventJobProgress {

    private static final String ID_SEPARATOR = ":";

    // <key>:<eventVersion>:<startedAt in ms>, one document per run.
    @Id
    private String id;

    // <projection>:<tenantId>:<sourceId>; a unique index lets one source have only one current run per projection.
    private String key;

    // A newer event closes the run, so the worker's next save of it fails.
    @Version
    private Long version;

    private String projection;
    private String type;
    private String tenantId;
    private String sourceId;

    // The event the run applies, as the outbox payload; the worker reads it into the spec's event class.
    private Map<String, Object> envelope;
    private long eventVersion;

    private EventJobStatus status;
    // The source's current run, RUNNING or FAILED: every event of the source goes to the tasks until a newer event
    // closes it.
    private boolean current;
    // The last _id done; saved only after its batch is written, so a crash repeats at most one batch.
    private String lastId;
    private long batches;
    private int failures;
    private String lastError;

    private Instant startedAt;
    private Instant updatedAt;
    // When the run ended DONE, FAILED or REPLACED.
    private Instant finishedAt;

    public static String buildKey(String projection, String tenantId, String sourceId) {
        return projection + ID_SEPARATOR + tenantId + ID_SEPARATOR + sourceId;
    }

    // A run that is not there: no status, so the worker skips it.
    public static ProjectionTask gone(String id) {
        return ProjectionTask.builder().id(id).build();
    }

    public static ProjectionTask open(String projection, String type, String tenantId, String sourceId,
                                      Map<String, Object> envelope, long eventVersion, Instant now) {
        String key = buildKey(projection, tenantId, sourceId);
        String id = key + ID_SEPARATOR + eventVersion + ID_SEPARATOR + now.toEpochMilli();
        return ProjectionTask.builder()
                .id(id)
                .key(key)
                .projection(projection)
                .type(type)
                .tenantId(tenantId)
                .sourceId(sourceId)
                .envelope(envelope)
                .eventVersion(eventVersion)
                .status(EventJobStatus.RUNNING)
                .current(true)
                .startedAt(now)
                .updatedAt(now)
                .build();
    }

    // The run id in the ticker's logs: the version of the event the task applies.
    @Override
    public String getRunId() {
        return "event version " + eventVersion;
    }

    // Every change returns a copy.
    public ProjectionTask recordBatch(String batchLastId, Instant now) {
        return toBuilder()
                .lastId(batchLastId)
                .batches(batches + 1)
                .failures(0)
                .updatedAt(now)
                .build();
    }

    public ProjectionTask recordFailure(String error, Instant now) {
        return toBuilder()
                .failures(failures + 1)
                .lastError(error)
                .updatedAt(now)
                .build();
    }

    // A FAILED run stays current, so the next event of its source still goes to the tasks.
    public ProjectionTask finish(EventJobStatus finalStatus, Instant now) {
        boolean stillCurrent = finalStatus == EventJobStatus.FAILED;
        return toBuilder()
                .status(finalStatus)
                .current(stillCurrent)
                .updatedAt(now)
                .finishedAt(now)
                .build();
    }

    // For a newer event: a RUNNING run ends REPLACED, a FAILED one keeps its status; neither is current any more.
    public ProjectionTask close(Instant now) {
        boolean wasRunning = status == EventJobStatus.RUNNING;
        EventJobStatus closedStatus = wasRunning ? EventJobStatus.REPLACED : status;
        Instant closedAt = wasRunning ? now : finishedAt;
        return toBuilder()
                .status(closedStatus)
                .current(false)
                .updatedAt(now)
                .finishedAt(closedAt)
                .build();
    }
}
