package com.openframe.event.jobs;

import com.openframe.event.jobs.backfill.config.BackfillConfiguration;
import com.openframe.event.jobs.backfill.config.properties.EventBackfillProperties;
import com.openframe.event.jobs.core.lock.EventJobLock;
import com.openframe.event.jobs.core.persistence.EventJob;
import com.openframe.event.jobs.core.persistence.EventJobRunIndexInitializer;
import com.openframe.event.jobs.core.repository.EventJobRepository;
import com.openframe.event.jobs.core.service.EventJobService;
import com.openframe.event.jobs.core.service.EventJobShutdown;
import com.openframe.event.jobs.core.service.EventJobTicker;
import com.openframe.event.jobs.reconciliation.config.ReconciliationConfiguration;
import com.openframe.event.jobs.reconciliation.config.properties.ReconciliationProperties;
import com.openframe.event.jobs.task.config.ProjectionTaskConfiguration;
import com.openframe.event.jobs.task.config.properties.ProjectionTaskProperties;
import com.openframe.event.jobs.task.persistence.ProjectionTaskIndexInitializer;
import com.openframe.event.jobs.task.repository.ProjectionTaskRepository;
import com.openframe.publishing.config.AggregateSpecAutoConfiguration;
import com.openframe.publishing.config.OutboxAutoConfiguration;
import net.javacrumbs.shedlock.core.LockProvider;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

import java.time.Clock;

// Only openframe-saas-stream has this module; it adds @EnableScheduling and a LockProvider.
@AutoConfiguration(after = {AggregateSpecAutoConfiguration.class, OutboxAutoConfiguration.class})
@ConditionalOnBooleanProperty(name = "openframe.events.enabled")
@EnableMongoRepositories(basePackageClasses = {EventJobRepository.class, ProjectionTaskRepository.class})
@EnableConfigurationProperties({EventBackfillProperties.class, ReconciliationProperties.class, ProjectionTaskProperties.class})
@Import({EventJobRunIndexInitializer.class, BackfillConfiguration.class, ReconciliationConfiguration.class,
        ProjectionTaskConfiguration.class})
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
    public EventJobTicker<EventJob> eventJobTicker(EventJobService jobService, EventJobShutdown shutdown) {
        Clock clock = Clock.systemUTC();
        return new EventJobTicker<>(jobService, shutdown, clock);
    }
}
