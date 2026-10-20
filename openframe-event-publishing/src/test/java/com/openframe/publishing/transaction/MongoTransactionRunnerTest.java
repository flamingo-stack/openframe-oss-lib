package com.openframe.publishing.transaction;

import com.mongodb.MongoException;
import com.mongodb.MongoWriteException;
import com.mongodb.ServerAddress;
import com.mongodb.WriteError;
import org.bson.BsonDocument;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.mongodb.UncategorizedMongoDbException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MongoTransactionRunnerTest {

    private final AtomicInteger attempts = new AtomicInteger();

    private MongoTransactionRunner runner;

    @BeforeEach
    void setUp() {
        PlatformTransactionManager manager = mock(PlatformTransactionManager.class);
        when(manager.getTransaction(any(TransactionDefinition.class))).thenReturn(new SimpleTransactionStatus());
        runner = new MongoTransactionRunner(new TransactionTemplate(manager));
    }

    @Test
    void aWriteConflict_runsOnce_andReachesTheCallerAsAVersionConflict() {
        UncategorizedMongoDbException failure = transientError(112, "WriteConflict");

        assertThatThrownBy(() -> runner.run(() -> {
            attempts.incrementAndGet();
            throw failure;
        })).isInstanceOf(OptimisticLockingFailureException.class).hasCause(failure);

        assertThat(attempts).hasValue(1);
    }

    @Test
    void anotherTransientError_suchAsAFailover_reachesTheCallerUnchanged() {
        UncategorizedMongoDbException failure = transientError(10107, "NotWritablePrimary");

        assertThatThrownBy(() -> runner.run(() -> {
            throw failure;
        })).isSameAs(failure);
    }

    @Test
    void anyOtherError_reachesTheCallerUnchanged() {
        IllegalStateException failure = new IllegalStateException("broken");

        assertThatThrownBy(() -> runner.run(() -> {
            attempts.incrementAndGet();
            throw failure;
        })).isSameAs(failure);

        assertThat(attempts).hasValue(1);
    }

    @Test
    void aDuplicateKeyReportedInsideTheTransaction_reachesTheCallerAsDuplicateKeyException() {
        WriteError duplicate = new WriteError(11000, "E11000 duplicate key", new BsonDocument());
        MongoWriteException writeException = new MongoWriteException(duplicate, new ServerAddress(), Set.of());

        assertThatThrownBy(() -> runner.run(() -> {
            throw new UncategorizedMongoDbException("write failed", writeException);
        })).isInstanceOf(DuplicateKeyException.class);
    }

    @Test
    void aCheckedExceptionOfTheAction_reachesTheCallerUnwrapped() {
        IOException failure = new IOException("disk");

        assertThatThrownBy(() -> runner.run(() -> {
            throw failure;
        })).isSameAs(failure);
    }

    private static UncategorizedMongoDbException transientError(int code, String name) {
        MongoException error = new MongoException(code, name);
        error.addLabel("TransientTransactionError");
        return new UncategorizedMongoDbException(name, error);
    }
}
