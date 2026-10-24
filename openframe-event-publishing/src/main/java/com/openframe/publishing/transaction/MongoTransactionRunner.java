package com.openframe.publishing.transaction;

import com.mongodb.ErrorCategory;
import com.mongodb.MongoException;
import com.mongodb.MongoWriteException;
import com.mongodb.ReadPreference;
import com.mongodb.TransactionOptions;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.MongoTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionOperations;
import org.springframework.transaction.support.TransactionTemplate;

import java.lang.reflect.UndeclaredThrowableException;

@Slf4j
public class MongoTransactionRunner {

    private static final int WRITE_CONFLICT_CODE = 112;
    private static final int DUPLICATE_KEY_CODE = 11000;

    private final TransactionOperations transactionOperations;

    public MongoTransactionRunner(MongoDatabaseFactory mongoDatabaseFactory) {
        this(transactionTemplate(mongoDatabaseFactory));
    }

    MongoTransactionRunner(TransactionOperations transactionOperations) {
        this.transactionOperations = transactionOperations;
    }

    // Not a bean: a registered MongoTransactionManager would turn every dormant @Transactional into a real transaction.
    private static TransactionOperations transactionTemplate(MongoDatabaseFactory mongoDatabaseFactory) {
        TransactionOptions options = TransactionOptions.builder()
                .readPreference(ReadPreference.primary())
                .build();
        MongoTransactionManager manager = new MongoTransactionManager(mongoDatabaseFactory, options);
        TransactionTemplate template = new TransactionTemplate(manager);
        template.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRED);
        return template;
    }

    // No retry here: a save already increased the version in the object, so running it again would overwrite the other write.
    public <T> T run(Transaction<T> action) {
        try {
            T result = transactionOperations.execute(status -> execute(action));
            log.debug("Outbox transaction committed");
            return result;
        } catch (RuntimeException e) {
            Throwable failure = unwrapUndeclaredThrowable(e);
            log.debug("Outbox transaction rolled back: {}", failure.getClass().getName());
            throw rethrow(failure);
        }
    }

    private static boolean isWriteConflict(Throwable failure) {
        for (Throwable cause = failure; cause != null && cause != cause.getCause(); cause = cause.getCause()) {
            if (cause instanceof MongoException mongo && mongo.getCode() == WRITE_CONFLICT_CODE) {
                return true;
            }
        }
        return false;
    }

    private static RuntimeException rethrow(Throwable failure) {
        Throwable translated = translated(failure);
        return sneakyThrow(translated);
    }

    // Only a write conflict means another write touched the document; a failover is transient too, but not a 409.
    private static Throwable translated(Throwable failure) {
        if (isWriteConflict(failure)) {
            log.debug("Outbox transaction hit a write conflict (112), reported as OptimisticLockingFailureException");
            String message = failure.getMessage();
            return new OptimisticLockingFailureException(message, failure);
        }
        return asDuplicateKey(failure);
    }

    // A duplicate key error (code 11000) becomes DuplicateKeyException; one reported as a write conflict is a version conflict above.
    private static Throwable asDuplicateKey(Throwable failure) {
        if (failure instanceof DuplicateKeyException) {
            return failure;
        }
        if (!isDuplicateKey(failure)) {
            return failure;
        }
        log.debug("Outbox transaction hit a duplicate key (11000), reported as DuplicateKeyException");
        String message = failure.getMessage();
        return new DuplicateKeyException(message, failure);
    }

    private static boolean isDuplicateKey(Throwable failure) {
        for (Throwable cause = failure; cause != null && cause != cause.getCause(); cause = cause.getCause()) {
            if (cause instanceof MongoWriteException write
                    && write.getError().getCategory() == ErrorCategory.DUPLICATE_KEY) {
                return true;
            }
            if (cause instanceof MongoException mongo && mongo.getCode() == DUPLICATE_KEY_CODE) {
                return true;
            }
        }
        return false;
    }

    @SneakyThrows
    private static <T> T execute(Transaction<T> action) {
        return action.execute();
    }

    @SneakyThrows
    private static RuntimeException sneakyThrow(Throwable throwable) {
        throw throwable;
    }

    // TransactionTemplate wraps an escaping checked exception; hand the caller the original.
    private static Throwable unwrapUndeclaredThrowable(RuntimeException failure) {
        if (failure instanceof UndeclaredThrowableException undeclared) {
            return undeclared.getUndeclaredThrowable();
        }
        return failure;
    }

    public interface Transaction<T> {
        T execute() throws Throwable;
    }
}
