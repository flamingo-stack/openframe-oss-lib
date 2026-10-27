package com.openframe.processing.exception;

// A projection failed on a record; the error handler never retries it, so the record goes to its DLT once.
public class EventProcessingFailedException extends RuntimeException {

    public EventProcessingFailedException(String projectionName, Throwable failure) {
        super("Projection " + projectionName + " failed", failure);
    }
}
