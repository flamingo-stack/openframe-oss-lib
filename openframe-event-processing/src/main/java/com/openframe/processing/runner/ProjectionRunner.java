package com.openframe.processing.runner;

import com.openframe.event.jobs.task.service.ProjectionTaskService;
import com.openframe.processing.config.properties.LargeUpdateProperties;
import com.openframe.processing.exception.EventProcessingFailedException;
import com.openframe.processing.exception.MongoUnavailableException;
import com.openframe.processing.mode.ProcessingModes;
import com.openframe.processing.version.ProjectionVersionRepository;
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
    private final ProjectionVersionRepository versions;

    // Sorted by name: the projections run, and the first failure is chosen, in the same order on every pod.
    public ProjectionRunner(AggregateSpecRegistry specRegistry, ProcessingModes modes, EventProcessingMetrics metrics,
                            ObjectProvider<ProjectionTaskService> projectionTasks, LargeUpdateProperties largeUpdateProperties,
                            ProjectionVersionRepository versions) {
        Comparator<Projection<?, ?>> byName = Comparator.comparing(Projection::name);
        Map<String, List<Projection<?, ?>>> byType = new HashMap<>();
        for (AggregateSpec<?, ?> spec : specRegistry.specs()) {
            String type = spec.getType();
            List<Projection<?, ?>> sorted = specRegistry.getProjections(type).stream()
                    .sorted(byName)
                    .toList();
            byType.put(type, sorted);
        }
        this.projectionsByType = Map.copyOf(byType);
        this.modes = modes;
        this.metrics = metrics;
        this.projectionTasks = projectionTasks;
        this.inlineLimit = largeUpdateProperties.getInlineLimit();
        this.versions = versions;
    }

    public void process(String type, String aggregateId, PublishedRecord<?> record) {
        // A newer envelope may mean something this build does not know: refused, so the DLT keeps it for a newer consumer.
        int schemaVersion = record.getSchemaVersion();
        if (schemaVersion > PublishedRecord.CURRENT_SCHEMA_VERSION) {
            throw new IllegalStateException("Schema version " + schemaVersion + " of " + type + " " + aggregateId
                    + " is newer than the supported " + PublishedRecord.CURRENT_SCHEMA_VERSION);
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
            Outcome outcome = applyIfNotOlder(projection, type, aggregateId, record);
            recordOutcome(sample, name, outcome, aggregateId, record);
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

    // An older event than the stored version is skipped; an equal one is applied, so a backfill still repairs drift.
    // Apply first, store second: a crash between them only applies the same event again.
    private Outcome applyIfNotOlder(Projection<?, ?> projection, String type, String aggregateId, PublishedRecord<?> record) {
        String name = projection.name();
        String tenantId = record.getTenantId();
        long version = record.getVersion();
        long storedVersion = versions.findStoredVersion(name, tenantId, aggregateId);
        if (version < storedVersion) {
            return Outcome.SKIPPED;
        }
        // No projection handles deletes yet; the version is kept, so a late older event after the delete is skipped.
        Outcome outcome;
        if (record.isDeleted()) {
            outcome = Outcome.DELETE_STORED;
        } else {
            outcome = applyOrHandOver(projection, type, aggregateId, record);
        }
        versions.saveVersionIfHigher(name, tenantId, aggregateId, version);
        return outcome;
    }

    private void recordOutcome(Timer.Sample sample, String name, Outcome outcome, String aggregateId, PublishedRecord<?> record) {
        switch (outcome) {
            case APPLIED -> metrics.recordApplied(sample, name);
            case HANDED_OVER -> metrics.recordHandedOver(sample, name);
            case SKIPPED -> metrics.recordSkipped(sample, name);
            case DELETE_STORED -> metrics.recordDeleteStored(sample, name);
        }
        log.debug("Projection {}: {} for {} version {} of tenant {}", name, outcome, aggregateId, record.getVersion(),
            record.getTenantId());
    }

    // Inline below the limit; at it, or while the source has a task, the task takes the event and the record is done once it is saved.
    // An event of the wrong class fails with ClassCastException, which is isolated like any other failure of the projection.
    @SuppressWarnings({"unchecked", "rawtypes"})
    private Outcome applyOrHandOver(Projection projection, String type, String aggregateId, PublishedRecord record) {
        String name = projection.name();
        String tenantId = record.getTenantId();
        ProjectionTaskService tasks = projectionTasks.getIfAvailable();
        if (tasks != null && tasks.hasTask(name, tenantId, aggregateId)) {
            tasks.submit(name, type, aggregateId, record);
            return Outcome.HANDED_OVER;
        }
        long changes = projection.countChanges(record, inlineLimit);
        if (changes < inlineLimit) {
            projection.apply(record);
            return Outcome.APPLIED;
        }
        if (tasks == null) {
            log.warn("Projection {} applies {} version {} of tenant {} inline although it changes {} or more items: "
                + "projection tasks are off", name, aggregateId, record.getVersion(), tenantId, inlineLimit);
            projection.apply(record);
            return Outcome.APPLIED;
        }
        tasks.submit(name, type, aggregateId, record);
        return Outcome.HANDED_OVER;
    }

    private enum Outcome {
        APPLIED,
        HANDED_OVER,
        SKIPPED,
        DELETE_STORED
    }

    @Getter
    @AllArgsConstructor
    private static class ProjectionFailure {

        private final String projectionName;
        private final Throwable failure;
    }
}
