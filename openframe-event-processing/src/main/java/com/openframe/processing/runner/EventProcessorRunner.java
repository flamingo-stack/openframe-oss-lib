package com.openframe.processing.runner;

import com.openframe.processing.api.EventProcessor;
import com.openframe.processing.exception.EventProcessingFailedException;
import com.openframe.processing.exception.MongoUnavailableException;
import com.openframe.processing.mode.ProcessingModes;
import com.openframe.processing.registry.EventProcessorRegistry;
import com.openframe.publishing.api.MongoUnavailability;
import com.openframe.publishing.api.PublishedAggregateType;
import com.openframe.publishing.api.PublishedRecord;
import io.micrometer.core.instrument.Timer;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

// Applies one event to the processors of its aggregate type, each on its own: a failing processor does not stop the others.
@Slf4j
@RequiredArgsConstructor
public class EventProcessorRunner {

    private final EventProcessorRegistry registry;
    private final ProcessingModes modes;
    private final EventProcessingMetrics metrics;

    public void process(PublishedAggregateType type, String aggregateId, PublishedRecord<?> record) {
        // A newer envelope may mean something this build does not know: refused, so the DLT keeps it for a newer consumer.
        int schemaVersion = record.getSchemaVersion();
        if (schemaVersion > PublishedRecord.CURRENT_SCHEMA_VERSION) {
            throw new IllegalStateException("Schema version " + schemaVersion + " of " + type.getName() + " " + aggregateId
                    + " is newer than the supported " + PublishedRecord.CURRENT_SCHEMA_VERSION);
        }
        // No processor handles deletes yet; the tombstone after the envelope is skipped by the listener.
        if (record.isDeleted()) {
            log.debug("Delete of {} {} skipped: no processor handles deletes", type.getName(), aggregateId);
            return;
        }

        Map<String, Throwable> failures = registry.processorsOf(type).stream()
            .filter(this::shouldRun)
            .flatMap(processor -> runProcessor(processor, aggregateId, record).stream())
            .collect(Collectors.toMap(
                ProcessorFailure::getProcessorName,
                ProcessorFailure::getFailure,
                (first, second) -> first, LinkedHashMap::new));

        if (!failures.isEmpty()) {
            throw new EventProcessingFailedException(failures);
        }
    }

    private boolean shouldRun(EventProcessor<?> processor) {
        String name = processor.name();
        boolean runs = modes.runsProcessor(name);
        if (!runs) {
            log.debug("Processor {} skipped: mode aspect", name);
        }
        return runs;
    }

    // Empty on success; Mongo down stops the stream; any Error but a broken JVM (StackOverflowError too) is the processor's.
    private Optional<ProcessorFailure> runProcessor(EventProcessor<?> processor, String aggregateId,
                                                    PublishedRecord<?> record) {
        String name = processor.name();
        Timer.Sample sample = metrics.start();
        try {
            long rows = applyTyped(processor, record);
            metrics.recordApplied(sample, name, rows);
            log.debug("Processor {} wrote {} row(s) for {} version {} of tenant {}", name, rows, aggregateId,
                record.getVersion(), record.getTenantId());
            return Optional.empty();
        } catch (OutOfMemoryError | InternalError | UnknownError brokenJvm) {
            throw brokenJvm;
        } catch (RuntimeException | Error failure) {
            if (MongoUnavailability.isMongoUnavailable(failure)) {
                metrics.recordMongoUnavailable(sample, name);
                throw new MongoUnavailableException(failure);
            }
            metrics.recordFailed(sample, name);
            log.warn("Processor {} failed for {} version {} of tenant {}", name, aggregateId, record.getVersion(),
                record.getTenantId(), failure);
            ProcessorFailure processorFailure = new ProcessorFailure(name, failure);
            return Optional.of(processorFailure);
        }
    }

    // An event of the wrong class fails with ClassCastException, which is isolated like any other failure of the processor.
    @SuppressWarnings({"unchecked", "rawtypes"})
    private static long applyTyped(EventProcessor processor, PublishedRecord record) {
        return processor.process(record);
    }

    @Getter
    @AllArgsConstructor
    private static class ProcessorFailure {

        private final String processorName;
        private final Throwable failure;
    }
}
