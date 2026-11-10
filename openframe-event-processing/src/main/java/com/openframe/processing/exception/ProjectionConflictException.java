package com.openframe.processing.exception;

// Another consumer of the same aggregate is still writing: retried by the listeners' error handler, like Mongo down.
public class ProjectionConflictException extends RuntimeException {

    public ProjectionConflictException(String projection, String aggregateId, Throwable cause) {
        super("Projection " + projection + " for " + aggregateId + " still conflicts with another consumer", cause);
    }
}
