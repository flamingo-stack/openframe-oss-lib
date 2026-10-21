package com.openframe.publishing.api;

import com.mongodb.MongoException;
import com.mongodb.MongoNodeIsRecoveringException;
import com.mongodb.MongoNotPrimaryException;
import com.mongodb.MongoSocketException;
import com.mongodb.MongoTimeoutException;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.OptimisticLockingFailureException;

import java.util.List;

// Whether a failure means Mongo cannot be reached, so retrying later helps: the processing listeners and the backfill ask it.
public final class MongoUnavailability {

    // RetryableWriteError has no constant in the driver.
    private static final List<String> TRANSIENT_LABELS = List.of(MongoException.TRANSIENT_TRANSACTION_ERROR_LABEL,
            "RetryableWriteError");

    private MongoUnavailability() {
    }

    // Network errors, no server to select, a primary stepping down or recovering, and errors Mongo labels as transient.
    public static boolean isMongoUnavailable(Throwable failure) {
        for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
            // A write conflict is the caller's own failure, even when Mongo labels it transient.
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
