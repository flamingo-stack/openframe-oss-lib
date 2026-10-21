package com.openframe.processing.runner;

import com.mongodb.MongoException;
import com.mongodb.MongoNodeIsRecoveringException;
import com.mongodb.MongoNotPrimaryException;
import com.mongodb.MongoSocketException;
import com.mongodb.MongoTimeoutException;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.OptimisticLockingFailureException;

import java.util.List;

// Mongo cannot be reached, so every processor would fail: the only exception the listeners' error handler retries.
public class MongoUnavailableException extends RuntimeException {

    // RetryableWriteError has no constant in the driver.
    private static final List<String> TRANSIENT_LABELS = List.of(MongoException.TRANSIENT_TRANSACTION_ERROR_LABEL,
            "RetryableWriteError");

    public MongoUnavailableException(Throwable cause) {
        super("Mongo is unavailable", cause);
    }

    // Network errors, no server to select, a primary stepping down or recovering, and errors Mongo labels as transient.
    static boolean isMongoUnavailable(Throwable failure) {
        for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
            // A write conflict is the processor's own failure, even when Mongo labels it transient.
            if (cause instanceof OptimisticLockingFailureException) {
                return false;
            }
            if (isUnavailability(cause)) {
                return true;
            }
        }
        return false;
    }

    private static boolean isUnavailability(Throwable cause) {
        if (cause instanceof DataAccessResourceFailureException || cause instanceof MongoSocketException
                || cause instanceof MongoTimeoutException || cause instanceof MongoNotPrimaryException
                || cause instanceof MongoNodeIsRecoveringException) {
            return true;
        }
        return cause instanceof MongoException mongoException && TRANSIENT_LABELS.stream().anyMatch(mongoException::hasErrorLabel);
    }
}
