package com.openframe.stream.enrichment;

import com.mongodb.client.MongoDatabase;
import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.provider.mongo.MongoLockProvider;
import net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@ConditionalOnProperty(name = "openframe.cve-enrichment.enabled", havingValue = "true")
@EnableScheduling
@EnableSchedulerLock(defaultLockAtMostFor = "PT30M")
public class CveEnrichmentSchedulingConfig {

    @Bean
    public LockProvider cveEnrichmentLockProvider(MongoDatabaseFactory mongoDatabaseFactory) {
        MongoDatabase database = mongoDatabaseFactory.getMongoDatabase();
        return new MongoLockProvider(database);
    }
}
