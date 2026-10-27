package com.openframe.processing.runner;

import com.openframe.processing.exception.EventProcessingFailedException;
import com.openframe.processing.exception.MongoUnavailableException;
import com.openframe.publishing.api.model.PublishedRecord;
import com.openframe.publishing.api.spec.Projection;
import com.openframe.publishing.api.util.MongoUnavailability;
import io.micrometer.core.instrument.Timer;
import lombok.extern.slf4j.Slf4j;

// Applies one event to one projection; each projection has its own listener, so the projections never wait on each other.
@Slf4j
public class ProjectionRunner {

    private final EventProcessingMetrics metrics;

    public ProjectionRunner(EventProcessingMetrics metrics) {
        this.metrics = metrics;
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
        applyProjection(projection, aggregateId, record);
    }

    // Mongo down is retried; any other failure, any Error but a broken JVM (StackOverflowError too), sends the record to the DLT.
    private void applyProjection(Projection<?, ?> projection, String aggregateId, PublishedRecord<?> record) {
        String name = projection.name();
        Timer.Sample sample = metrics.start();
        try {
            applyTyped(projection, record);
            metrics.recordApplied(sample, name);
            log.debug("Projection {} applied {} version {} of tenant {}", name, aggregateId, record.getVersion(),
                record.getTenantId());
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

    // An event of the wrong class fails with ClassCastException, which is isolated like any other failure of the projection.
    @SuppressWarnings({"unchecked", "rawtypes"})
    private static void applyTyped(Projection projection, PublishedRecord record) {
        projection.apply(record);
    }
}
