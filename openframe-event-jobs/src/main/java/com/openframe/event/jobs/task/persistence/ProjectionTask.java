package com.openframe.event.jobs.task.persistence;

import com.openframe.event.jobs.core.persistence.EventJobStatus;
import com.openframe.event.jobs.core.service.EventJobProgress;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.Map;

// One large update of a projection, for one source document; deleted when done. Every tenant's, so not TenantScoped.
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "event_projection_tasks")
public class ProjectionTask implements EventJobProgress {

    private static final String ID_SEPARATOR = ":";

    // <projection>:<tenantId>:<sourceId>, so one source has one task per projection.
    @Id
    private String id;

    // A newer event bumps it, so the worker's next save fails and a finished task is deleted only if nothing changed.
    @Version
    private Long version;

    private String projection;
    private String type;
    private String tenantId;
    private String sourceId;

    // The newest event of the source, as the outbox payload; the worker reads it into the spec's event class.
    private Map<String, Object> envelope;
    private long eventVersion;

    private EventJobStatus status;
    // The last _id done; saved only after its batch is written, so a crash repeats at most one batch.
    private String lastId;
    private long batches;
    private int failures;
    private String lastError;

    private Instant createdAt;
    // Set again by every newer event: the task starts again from the first item.
    private Instant startedAt;
    private Instant updatedAt;

    public static String idOf(String projection, String tenantId, String sourceId) {
        return projection + ID_SEPARATOR + tenantId + ID_SEPARATOR + sourceId;
    }

    // A task that is not there: no status, so the worker skips it.
    public static ProjectionTask gone(String id) {
        return ProjectionTask.builder().id(id).build();
    }

    public static ProjectionTask open(String projection, String type, String tenantId, String sourceId,
                                      Map<String, Object> envelope, long eventVersion, Instant now) {
        String id = idOf(projection, tenantId, sourceId);
        ProjectionTask task = ProjectionTask.builder()
                .id(id)
                .projection(projection)
                .type(type)
                .tenantId(tenantId)
                .sourceId(sourceId)
                .createdAt(now)
                .build();
        return task.restartWith(envelope, eventVersion, now);
    }

    // The run id in the ticker's logs: the version of the event the task applies.
    @Override
    public String getRunId() {
        return "event version " + eventVersion;
    }

    // Every change returns a copy.
    public ProjectionTask restartWith(Map<String, Object> newEnvelope, long newEventVersion, Instant now) {
        return toBuilder()
                .envelope(newEnvelope)
                .eventVersion(newEventVersion)
                .status(EventJobStatus.RUNNING)
                .lastId(null)
                .batches(0)
                .failures(0)
                .lastError(null)
                .startedAt(now)
                .updatedAt(now)
                .build();
    }

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

    public ProjectionTask finish(EventJobStatus finalStatus, Instant now) {
        return toBuilder()
                .status(finalStatus)
                .updatedAt(now)
                .build();
    }
}
