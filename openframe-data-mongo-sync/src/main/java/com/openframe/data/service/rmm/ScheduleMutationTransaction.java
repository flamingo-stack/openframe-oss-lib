package com.openframe.data.service.rmm;

import com.openframe.publishing.transaction.MongoTransactionRunner;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.stereotype.Component;

/** Commits scheduling changes together with the schedule or device state that permits them. */
@Component
public class ScheduleMutationTransaction {

    private final MongoTransactionRunner transactions;

    public ScheduleMutationTransaction(MongoDatabaseFactory databaseFactory) {
        transactions = new MongoTransactionRunner(databaseFactory);
    }

    public <T> T run(MongoTransactionRunner.Transaction<T> mutation) {
        return transactions.run(mutation);
    }
}
