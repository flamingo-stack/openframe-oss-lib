package com.openframe.processing.runner;

import java.util.List;
import java.util.Map;

// Thrown after every processor of the record ran; its message names the failed ones, and each failure's stack trace is kept.
public class EventProcessingFailedException extends RuntimeException {

    public EventProcessingFailedException(Map<String, Throwable> failuresByProcessor) {
        super("Processor(s) " + failuresByProcessor.keySet() + " failed");
        List<Throwable> failures = List.copyOf(failuresByProcessor.values());
        initCause(failures.getFirst());
        failures.stream().skip(1).forEach(this::addSuppressed);
    }
}
