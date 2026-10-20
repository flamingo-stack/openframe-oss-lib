package com.openframe.stream.handler.software;

import com.mongodb.client.MongoDatabase;
import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.provider.mongo.MongoLockProvider;
import net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@ConditionalOnProperty(name = "openframe.rmm.software.cascade.enabled", havingValue = "true", matchIfMissing = true)
@EnableScheduling
@EnableSchedulerLock(defaultLockAtMostFor = "PT10M")
public class SoftwareCdcSchedulingConfig {

    @Bean
    @ConditionalOnMissingBean(LockProvider.class)
    public LockProvider lockProvider(MongoDatabaseFactory mongoDatabaseFactory) {
        MongoDatabase database = mongoDatabaseFactory.getMongoDatabase();
        return new MongoLockProvider(database);
    }
}
