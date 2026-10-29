package com.openframe.publishing.api.util;

import com.mongodb.MongoException;
import com.mongodb.MongoNodeIsRecoveringException;
import com.mongodb.MongoNotPrimaryException;
import com.mongodb.MongoSocketException;
import com.mongodb.MongoSocketReadTimeoutException;
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

    // The whole cause chain, because Spring wraps the driver's exception in a DataAccessResourceFailureException.
    public static boolean isMongoUnavailable(Throwable failure) {
        boolean unavailable = false;
        for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
            // A write conflict is the caller's own failure; a read timeout is a slow query, retried forever.
            if (cause instanceof OptimisticLockingFailureException || cause instanceof MongoSocketReadTimeoutException) {
                return false;
            }
            unavailable = unavailable || isUnavailability(cause);
        }
        return unavailable;
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
