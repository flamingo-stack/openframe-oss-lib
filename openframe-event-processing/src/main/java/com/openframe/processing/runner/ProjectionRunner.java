package com.openframe.processing.runner;

import com.openframe.event.jobs.task.service.ProjectionTaskService;
import com.openframe.processing.config.properties.LargeUpdateProperties;
import com.openframe.processing.exception.EventProcessingFailedException;
import com.openframe.processing.exception.MongoUnavailableException;
import com.openframe.publishing.api.model.PublishedRecord;
import com.openframe.publishing.api.spec.Projection;
import com.openframe.publishing.api.util.MongoUnavailability;
import io.micrometer.core.instrument.Timer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;

// Applies one event to one projection; each projection has its own listener, so the projections never wait on each other.
@Slf4j
public class ProjectionRunner {

    private final EventProcessingMetrics metrics;
    // A provider: openframe-event-jobs' beans, which a context without that module's auto-configuration does not have.
    private final ObjectProvider<ProjectionTaskService> projectionTasks;
    private final int inlineLimit;

    public ProjectionRunner(EventProcessingMetrics metrics, ObjectProvider<ProjectionTaskService> projectionTasks,
                            LargeUpdateProperties largeUpdateProperties) {
        this.metrics = metrics;
        this.projectionTasks = projectionTasks;
        this.inlineLimit = largeUpdateProperties.getInlineLimit();
    }

    public void process(String type, Projection<?, ?> projection, String aggregateId, PublishedRecord<?> record) {
        // A newer envelope may mean something this build does not know: refused, so the DLT keeps it for a newer consumer.
        int schemaVersion = record.getSchemaVersion();
        if (schemaVersion > PublishedRecord.CURRENT_SCHEMA_VERSION) {
            throw new IllegalStateException("Schema version " + schemaVersion + " of " + type + " " + aggregateId
                    + " is newer than the supported " + PublishedRecord.CURRENT_SCHEMA_VERSION);
        }
        // No projection handles deletes yet; the tombstone after the envelope is skipped by the listener.
        if (record.isDeleted()) {
            log.debug("Delete of {} {} skipped: no projection handles deletes", type, aggregateId);
            return;
        }
        applyProjection(projection, type, aggregateId, record);
    }

    // Mongo down is retried; any other failure, any Error but a broken JVM (StackOverflowError too), sends the record to the DLT.
    private void applyProjection(Projection<?, ?> projection, String type, String aggregateId, PublishedRecord<?> record) {
        String name = projection.name();
        Timer.Sample sample = metrics.start();
        try {
            boolean handedOver = applyOrHandOver(projection, type, aggregateId, record);
            if (handedOver) {
                metrics.recordHandedOver(sample, name);
                log.debug("Projection {} handed {} version {} of tenant {} over to its task", name, aggregateId,
                    record.getVersion(), record.getTenantId());
            } else {
                metrics.recordApplied(sample, name);
                log.debug("Projection {} applied {} version {} of tenant {}", name, aggregateId, record.getVersion(),
                    record.getTenantId());
            }
        } catch (OutOfMemoryError | InternalError | UnknownError brokenJvm) {
            throw brokenJvm;
        } catch (RuntimeException | Error failure) {
            if (MongoUnavailability.isMongoUnavailable(failure)) {
                metrics.recordMongoUnavailable(sample, name);
                throw new MongoUnavailableException(failure);
            }
            metrics.recordFailed(sample, name);
            log.warn("Projection {} failed for {} version {} of tenant {}", name, aggregateId, record.getVersion(),
                record.getTenantId(), failure);
            throw new EventProcessingFailedException(name, failure);
        }
    }

    // Inline below the limit; at it, or while the source has a task, the task takes the event and the record is done once it is saved.
    // An event of the wrong class fails with ClassCastException, which is isolated like any other failure of the projection.
    @SuppressWarnings({"unchecked", "rawtypes"})
    private boolean applyOrHandOver(Projection projection, String type, String aggregateId, PublishedRecord record) {
        String name = projection.name();
        String tenantId = record.getTenantId();
        ProjectionTaskService tasks = projectionTasks.getIfAvailable();
        if (tasks != null && tasks.hasTask(name, tenantId, aggregateId)) {
            tasks.submit(name, type, aggregateId, record);
            return true;
        }
        long changes = projection.countChanges(record, inlineLimit);
        if (changes < inlineLimit) {
            projection.apply(record);
            return false;
        }
        if (tasks == null) {
            log.warn("Projection {} applies {} version {} of tenant {} inline although it changes {} or more items: "
                + "projection tasks are not configured", name, aggregateId, record.getVersion(), tenantId, inlineLimit);
            projection.apply(record);
            return false;
        }
        tasks.submit(name, type, aggregateId, record);
        return true;
    }
}
