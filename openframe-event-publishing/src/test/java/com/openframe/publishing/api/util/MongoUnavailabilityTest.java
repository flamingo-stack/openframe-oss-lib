package com.openframe.publishing.api.util;

import com.mongodb.MongoException;
import com.mongodb.MongoNotPrimaryException;
import com.mongodb.MongoSocketOpenException;
import com.mongodb.MongoSocketReadTimeoutException;
import com.mongodb.ServerAddress;
import org.bson.BsonDocument;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.mongodb.UncategorizedMongoDbException;

import java.net.SocketTimeoutException;

import static org.assertj.core.api.Assertions.assertThat;

class MongoUnavailabilityTest {

    @Test
    void anErrorMongoLabelsTransient_isMongoDown_butAWriteConflictIsNot() {
        MongoException transientError = new MongoException("transient");
        transientError.addLabel(MongoException.TRANSIENT_TRANSACTION_ERROR_LABEL);
        OptimisticLockingFailureException conflict = new OptimisticLockingFailureException("write conflict", transientError);

        assertThat(MongoUnavailability.isMongoUnavailable(transientError)).isTrue();
        assertThat(MongoUnavailability.isMongoUnavailable(conflict)).isFalse();
    }

    @Test
    void aPrimaryStepDown_wrappedBySpring_isMongoDown() {
        MongoNotPrimaryException notPrimary = new MongoNotPrimaryException(new BsonDocument(), new ServerAddress());
        UncategorizedMongoDbException wrapped = new UncategorizedMongoDbException("not primary", notPrimary);

        assertThat(MongoUnavailability.isMongoUnavailable(wrapped)).isTrue();
    }

    @Test
    void aResourceFailure_isMongoDown_butAnyOtherErrorIsNot() {
        DataAccessResourceFailureException unreachable = new DataAccessResourceFailureException("no server");
        IllegalStateException bug = new IllegalStateException("bug");

        assertThat(MongoUnavailability.isMongoUnavailable(unreachable)).isTrue();
        assertThat(MongoUnavailability.isMongoUnavailable(bug)).isFalse();
    }

    // A query that always runs longer than socketTimeoutMS would otherwise be retried as Mongo down for good.
    @Test
    void aReadTimeout_wrappedBySpring_isNotMongoDown_butASocketThatCannotOpenIs() {
        ServerAddress server = new ServerAddress("mongo-0", 27017);
        MongoSocketReadTimeoutException slowQuery = new MongoSocketReadTimeoutException("read timed out", server,
                new SocketTimeoutException("Read timed out"));
        DataAccessResourceFailureException wrappedSlowQuery = new DataAccessResourceFailureException("timeout", slowQuery);
        MongoSocketOpenException cannotConnect = new MongoSocketOpenException("connection refused", server);
        DataAccessResourceFailureException wrappedCannotConnect = new DataAccessResourceFailureException("down", cannotConnect);

        assertThat(MongoUnavailability.isMongoUnavailable(wrappedSlowQuery)).isFalse();
        assertThat(MongoUnavailability.isMongoUnavailable(slowQuery)).isFalse();
        assertThat(MongoUnavailability.isMongoUnavailable(wrappedCannotConnect)).isTrue();
    }
}
