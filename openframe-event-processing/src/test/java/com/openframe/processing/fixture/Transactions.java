package com.openframe.processing.fixture;

import com.openframe.publishing.transaction.MongoTransactionRunner;

import java.util.concurrent.atomic.AtomicBoolean;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

// Runs the action without a transaction, for the tests that have no Mongo.
public final class Transactions {

    private Transactions() {
    }

    public static MongoTransactionRunner buildPassThrough() {
        return buildPassThrough(new AtomicBoolean());
    }

    // open is true while an action runs, so a test can tell what ran inside the transaction.
    public static MongoTransactionRunner buildPassThrough(AtomicBoolean open) {
        MongoTransactionRunner transactions = mock(MongoTransactionRunner.class);
        when(transactions.run(any())).thenAnswer(invocation -> {
            MongoTransactionRunner.Transaction<?> action = invocation.getArgument(0);
            open.set(true);
            try {
                return action.execute();
            } finally {
                open.set(false);
            }
        });
        return transactions;
    }
}
