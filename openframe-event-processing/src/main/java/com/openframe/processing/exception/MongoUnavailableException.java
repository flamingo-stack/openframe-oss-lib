package com.openframe.processing.exception;

// Mongo cannot be reached, so every processor would fail: the only exception the listeners' error handler retries.
public class MongoUnavailableException extends RuntimeException {

    public MongoUnavailableException(Throwable cause) {
        super("Mongo is unavailable", cause);
    }
}
