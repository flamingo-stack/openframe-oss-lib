package com.openframe.processing.runner;

import com.openframe.event.jobs.task.service.ProjectionTaskService;
import com.openframe.processing.config.properties.LargeUpdateProperties;
import com.openframe.processing.exception.EventProcessingFailedException;
import com.openframe.processing.exception.MongoUnavailableException;
import com.openframe.processing.exception.ProjectionConflictException;
import com.openframe.processing.version.ProjectionVersionRepository;
import com.openframe.publishing.api.model.PublishedRecord;
import com.openframe.publishing.api.spec.AggregateSpec;
import com.openframe.publishing.api.spec.Projection;
import com.openframe.publishing.api.util.MongoUnavailability;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import com.openframe.publishing.transaction.MongoTransactionRunner;
import io.micrometer.core.instrument.Timer;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.OptimisticLockingFailureException;

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

    // 50 ms doubling, 750 ms in all; a conflict that lasts longer goes to the error handler, which retries the record.
    private static final int MAX_TRANSACTION_ATTEMPTS = 5;
    private static final long FIRST_RETRY_DELAY_MS = 50;

    private final Map<String, List<Projection<?, ?>>> projectionsByType;
    private final EventProcessingMetrics metrics;
    // A provider: openframe-event-jobs' beans, which a context without that module's auto-configuration does not have.
    private final ObjectProvider<ProjectionTaskService> projectionTasks;
    private final int inlineLimit;
    private final ProjectionVersionRepository versions;
    private final MongoTransactionRunner transactions;

    // Sorted by name: the projections run, and the first failure is chosen, in the same order on every pod.
    public ProjectionRunner(AggregateSpecRegistry specRegistry, EventProcessingMetrics metrics,
                            ObjectProvider<ProjectionTaskService> projectionTasks, LargeUpdateProperties largeUpdateProperties,
                            ProjectionVersionRepository versions, MongoTransactionRunner transactions) {
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
        this.metrics = metrics;
        this.projectionTasks = projectionTasks;
        this.inlineLimit = largeUpdateProperties.getInlineLimit();
        this.versions = versions;
        this.transactions = transactions;
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
            .flatMap(projection -> applyProjection(projection, type, aggregateId, record).stream())
            .collect(Collectors.toMap(
                ProjectionFailure::getProjectionName,
                ProjectionFailure::getFailure,
                (first, second) -> first, LinkedHashMap::new));

        if (!failures.isEmpty()) {
            throw new EventProcessingFailedException(failures);
        }
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
        } catch (ProjectionConflictException conflict) {
            throw conflict;
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

    private Outcome applyIfNotOlder(Projection<?, ?> projection, String type, String aggregateId, PublishedRecord<?> record) {
        for (int attempt = 1; ; attempt++) {
            try {
                Outcome outcome = transactions.run(() -> applyInTransaction(projection, aggregateId, record));
                if (outcome == Outcome.HANDED_OVER) {
                    return handOver(projection, type, aggregateId, record);
                }
                return outcome;
            } catch (OptimisticLockingFailureException | DuplicateKeyException conflict) {
                if (attempt == MAX_TRANSACTION_ATTEMPTS) {
                    throw new ProjectionConflictException(projection.name(), aggregateId, conflict);
                }
                log.debug("Projection {} for {} conflicted, attempt {}: {}", projection.name(), aggregateId, attempt,
                    conflict.toString());
                long delayMs = FIRST_RETRY_DELAY_MS << (attempt - 1);
                waitBeforeRetry(delayMs, conflict);
            }
        }
    }

    private static void waitBeforeRetry(long delayMs, RuntimeException conflict) {
        try {
            Thread.sleep(delayMs);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw conflict;
        }
    }

    // An older event is skipped and an equal one applied, so a backfill still repairs drift; the version is written first.
    private Outcome applyInTransaction(Projection<?, ?> projection, String aggregateId, PublishedRecord<?> record) {
        String name = projection.name();
        String tenantId = record.getTenantId();
        long version = record.getVersion();
        long storedVersion = versions.findStoredVersion(name, tenantId, aggregateId);
        if (version < storedVersion) {
            return Outcome.SKIPPED;
        }
        versions.saveVersionIfHigher(name, tenantId, aggregateId, version);
        // The version is kept after a delete, so a late older event is skipped.
        if (record.isDeleted()) {
            projection.applyDelete(tenantId, aggregateId);
            return Outcome.DELETED;
        }
        return applyOrDecideHandOver(projection, aggregateId, record);
    }

    private void recordOutcome(Timer.Sample sample, String name, Outcome outcome, String aggregateId, PublishedRecord<?> record) {
        switch (outcome) {
            case APPLIED -> metrics.recordApplied(sample, name);
            case UNCHANGED -> metrics.recordUnchanged(sample, name);
            case HANDED_OVER -> metrics.recordHandedOver(sample, name);
            case SKIPPED -> metrics.recordSkipped(sample, name);
            case DELETED -> metrics.recordDeleted(sample, name);
        }
        log.debug("Projection {}: {} for {} version {} of tenant {}", name, outcome, aggregateId, record.getVersion(),
            record.getTenantId());
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private Outcome applyOrDecideHandOver(Projection projection, String aggregateId, PublishedRecord record) {
        String name = projection.name();
        String tenantId = record.getTenantId();
        ProjectionTaskService tasks = projectionTasks.getIfAvailable();
        if (tasks != null && tasks.hasTask(name, tenantId, aggregateId)) {
            return Outcome.HANDED_OVER;
        }
        long changes = projection.countChanges(record, inlineLimit);
        // Most events change no copy, such as a save that kept the name; their version is still stored.
        if (changes == 0) {
            return Outcome.UNCHANGED;
        }
        if (changes < inlineLimit) {
            projection.apply(record);
            return Outcome.APPLIED;
        }
        if (tasks == null) {
            log.warn("Projection {} applies {} version {} of tenant {} inline although it changes {} or more items: "
                + "projection tasks are not configured", name, aggregateId, record.getVersion(), tenantId, inlineLimit);
            projection.apply(record);
            return Outcome.APPLIED;
        }
        return Outcome.HANDED_OVER;
    }

    // After the commit; a newer version stored meanwhile by another consumer keeps this older event from opening a task.
    private Outcome handOver(Projection<?, ?> projection, String type, String aggregateId, PublishedRecord<?> record) {
        String name = projection.name();
        String tenantId = record.getTenantId();
        long storedVersion = versions.findStoredVersion(name, tenantId, aggregateId);
        if (record.getVersion() < storedVersion) {
            return Outcome.SKIPPED;
        }
        ProjectionTaskService tasks = projectionTasks.getObject();
        tasks.submit(name, type, aggregateId, record);
        return Outcome.HANDED_OVER;
    }

    private enum Outcome {
        APPLIED,
        UNCHANGED,
        HANDED_OVER,
        SKIPPED,
        DELETED
    }

    @Getter
    @AllArgsConstructor
    private static class ProjectionFailure {

        private final String projectionName;
        private final Throwable failure;
    }
}
