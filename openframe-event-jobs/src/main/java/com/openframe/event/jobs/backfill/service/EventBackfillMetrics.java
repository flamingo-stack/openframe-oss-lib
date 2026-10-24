package com.openframe.event.jobs.backfill.service;

import com.openframe.publishing.registry.AggregateSpecRegistry;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;

import java.util.HashMap;
import java.util.Map;

// Registered at startup for every type with zero, so increase() sees the first document and the first failed run.
public class EventBackfillMetrics {

    private static final String DOCUMENTS_COUNTER = "openframe.events.backfill.documents";
    private static final String FAILED_COUNTER = "openframe.events.backfill.failed";
    private static final String TAG_TYPE = "type";

    private final Map<String, Counter> documents;
    private final Map<String, Counter> failed;

    public EventBackfillMetrics(MeterRegistry meterRegistry, AggregateSpecRegistry specRegistry) {
        Map<String, Counter> documentCounters = new HashMap<>();
        Map<String, Counter> failedCounters = new HashMap<>();
        for (String type : specRegistry.types()) {
            Counter documentCounter = meterRegistry.counter(DOCUMENTS_COUNTER, TAG_TYPE, type);
            Counter failedCounter = meterRegistry.counter(FAILED_COUNTER, TAG_TYPE, type);
            documentCounters.put(type, documentCounter);
            failedCounters.put(type, failedCounter);
        }
        this.documents = Map.copyOf(documentCounters);
        this.failed = Map.copyOf(failedCounters);
    }

    void recordDocuments(String type, int count) {
        Counter counter = documents.get(type);
        counter.increment(count);
    }

    void recordFailed(String type) {
        Counter counter = failed.get(type);
        counter.increment();
    }
}
