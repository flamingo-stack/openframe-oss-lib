package com.openframe.event.jobs.config;

import com.openframe.event.jobs.config.properties.EventBackfillProperties;
import com.openframe.event.jobs.config.properties.ReconciliationProperties;
import com.openframe.event.jobs.lock.EventJobLock;
import com.openframe.event.jobs.repository.EventJobRepository;
import com.openframe.event.jobs.service.EventJobService;
import com.openframe.event.jobs.service.EventJobShutdown;
import com.openframe.event.jobs.service.EventJobTicker;
import com.openframe.publishing.config.OutboxAutoConfiguration;
import net.javacrumbs.shedlock.core.LockProvider;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

import java.time.Clock;

// Off by default; the service that turns it on (openframe-saas-stream) adds @EnableScheduling and a LockProvider.
@AutoConfiguration(after = OutboxAutoConfiguration.class)
@ConditionalOnBooleanProperty(name = "openframe.events.jobs.enabled")
@EnableMongoRepositories(basePackageClasses = EventJobRepository.class)
@EnableConfigurationProperties({EventBackfillProperties.class, ReconciliationProperties.class})
@Import({BackfillConfiguration.class, BackfillWithoutPublishingWarning.class, ReconciliationConfiguration.class})
public class EventJobsAutoConfiguration {

    // Ours, not a LockingTaskExecutor bean, so a service's own ShedLock setup stays as it is.
    @Bean
    public EventJobLock eventJobLock(LockProvider lockProvider) {
        Clock clock = Clock.systemUTC();
        return new EventJobLock(lockProvider, clock);
    }

    @Bean
    public EventJobService eventJobService(EventJobRepository jobRepository) {
        Clock clock = Clock.systemUTC();
        return new EventJobService(jobRepository, clock);
    }

    @Bean
    public EventJobShutdown eventJobShutdown() {
        return new EventJobShutdown();
    }

    @Bean
    public EventJobTicker eventJobTicker(EventJobService jobService, EventJobShutdown shutdown) {
        Clock clock = Clock.systemUTC();
        return new EventJobTicker(jobService, shutdown, clock);
    }
}
