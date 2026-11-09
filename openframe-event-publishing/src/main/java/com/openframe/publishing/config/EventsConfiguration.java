package com.openframe.publishing.config;

import com.openframe.publishing.transaction.MongoTransactionRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.mongodb.MongoDatabaseFactory;

@Configuration
public class EventsConfiguration {

    // Lazy: created on the first published write, so an app with publish off never needs it.
    @Bean
    @Lazy
    public MongoTransactionRunner mongoTransactionRunner(MongoDatabaseFactory mongoDatabaseFactory) {
        return new MongoTransactionRunner(mongoDatabaseFactory);
    }
}
