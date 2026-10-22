package com.openframe.processing.runner;

import com.openframe.event.jobs.task.service.ProjectionTaskService;
import com.openframe.processing.config.properties.LargeUpdateProperties;
import com.openframe.processing.exception.EventProcessingFailedException;
import com.openframe.processing.exception.MongoUnavailableException;
import com.openframe.processing.mode.ProcessingModes;
import com.openframe.publishing.api.model.PublishedRecord;
import com.openframe.publishing.api.spec.AggregateSpec;
import com.openframe.publishing.api.spec.Projection;
import com.openframe.publishing.api.util.MongoUnavailability;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;

import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

// Applies one event to the projections of its aggregate type, each on its own: a failing projection does not stop the others.
@Slf4j
public class ProjectionRunner {

    private final Map<String, List<Projection<?, ?>>> projectionsByType;
    private final ProcessingModes modes;
    private final EventProcessingMetrics metrics;
    // A provider: the projection tasks are openframe-event-jobs' beans, with their own switch.
    private final ObjectProvider<ProjectionTaskService> projectionTasks;
    private final int inlineLimit;

    // Sorted by name: the projections run, and the first failure is chosen, in the same order on every pod.
    public ProjectionRunner(AggregateSpecRegistry specRegistry, ProcessingModes modes, EventProcessingMetrics metrics,
                            ObjectProvider<ProjectionTaskService> projectionTasks, LargeUpdateProperties largeUpdateProperties) {
        Comparator<Projection<?, ?>> byName = Comparator.comparing(Projection::name);
        Map<String, List<Projection<?, ?>>> byType = new HashMap<>();
        for (AggregateSpec<?, ?> spec : specRegistry.specs()) {
            String type = spec.getType();
            List<Projection<?, ?>> sorted = spec.projections().stream()
                    .<Projection<?, ?>>map(projection -> projection)
                    .sorted(byName)
                    .toList();
            byType.put(type, sorted);
        }
        this.projectionsByType = Map.copyOf(byType);
        this.modes = modes;
        this.metrics = metrics;
        this.projectionTasks = projectionTasks;
        this.inlineLimit = largeUpdateProperties.getInlineLimit();
    }

    public void process(String type, String aggregateId, PublishedRecord<?> record) {
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

        List<Projection<?, ?>> projections = projectionsByType.getOrDefault(type, List.of());
        Map<String, Throwable> failures = projections.stream()
            .filter(this::shouldRun)
            .flatMap(projection -> applyProjection(projection, type, aggregateId, record).stream())
            .collect(Collectors.toMap(
                ProjectionFailure::getProjectionName,
                ProjectionFailure::getFailure,
                (first, second) -> first, LinkedHashMap::new));

        if (!failures.isEmpty()) {
            throw new EventProcessingFailedException(failures);
        }
    }

    private boolean shouldRun(Projection<?, ?> projection) {
        String name = projection.name();
        boolean runs = modes.runsProjection(name);
        if (!runs) {
            log.debug("Projection {} skipped: mode aspect", name);
        }
        return runs;
    }

    // Empty on success; Mongo down stops the stream; any Error but a broken JVM (StackOverflowError too) is the projection's.
    private Optional<ProjectionFailure> applyProjection(Projection<?, ?> projection, String type, String aggregateId,
                                                        PublishedRecord<?> record) {
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
            return Optional.empty();
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
            ProjectionFailure projectionFailure = new ProjectionFailure(name, failure);
            return Optional.of(projectionFailure);
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
                + "projection tasks are off", name, aggregateId, record.getVersion(), tenantId, inlineLimit);
            projection.apply(record);
            return false;
        }
        tasks.submit(name, type, aggregateId, record);
        return true;
    }

    @Getter
    @AllArgsConstructor
    private static class ProjectionFailure {

        private final String projectionName;
        private final Throwable failure;
    }
}
