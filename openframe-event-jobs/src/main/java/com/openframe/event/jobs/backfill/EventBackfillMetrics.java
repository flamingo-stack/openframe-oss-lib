package com.openframe.event.jobs.backfill;

import com.openframe.publishing.api.PublishedAggregateType;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;

import java.util.EnumMap;
import java.util.Map;

// Registered at startup for every type with zero, so increase() sees the first document and the first failed run.
public class EventBackfillMetrics {

    private static final String DOCUMENTS_COUNTER = "openframe.events.backfill.documents";
    private static final String FAILED_COUNTER = "openframe.events.backfill.failed";
    private static final String TAG_TYPE = "type";

    private final Map<PublishedAggregateType, Counter> documents;
    private final Map<PublishedAggregateType, Counter> failed;

    public EventBackfillMetrics(MeterRegistry meterRegistry) {
        Map<PublishedAggregateType, Counter> documentCounters = new EnumMap<>(PublishedAggregateType.class);
        Map<PublishedAggregateType, Counter> failedCounters = new EnumMap<>(PublishedAggregateType.class);
        for (PublishedAggregateType type : PublishedAggregateType.values()) {
            String name = type.getName();
            Counter documentCounter = meterRegistry.counter(DOCUMENTS_COUNTER, TAG_TYPE, name);
            Counter failedCounter = meterRegistry.counter(FAILED_COUNTER, TAG_TYPE, name);
            documentCounters.put(type, documentCounter);
            failedCounters.put(type, failedCounter);
        }
        this.documents = documentCounters;
        this.failed = failedCounters;
    }

    void recordDocuments(PublishedAggregateType type, int count) {
        Counter counter = documents.get(type);
        counter.increment(count);
    }

    void recordFailed(PublishedAggregateType type) {
        Counter counter = failed.get(type);
        counter.increment();
    }
}
