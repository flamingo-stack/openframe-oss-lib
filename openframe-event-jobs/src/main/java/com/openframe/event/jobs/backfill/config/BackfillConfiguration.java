package com.openframe.event.jobs.backfill.config;

import com.openframe.event.jobs.backfill.config.properties.EventBackfillProperties;
import com.openframe.event.jobs.backfill.scheduler.EventBackfillJob;
import com.openframe.event.jobs.backfill.service.EventBackfillMetrics;
import com.openframe.event.jobs.backfill.service.EventBackfillRunner;
import com.openframe.event.jobs.backfill.service.EventBackfillService;
import com.openframe.event.jobs.core.lock.EventJobLock;
import com.openframe.event.jobs.core.persistence.EventJob;
import com.openframe.event.jobs.core.service.EventJobService;
import com.openframe.event.jobs.core.service.EventJobTicker;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import com.openframe.publishing.registry.PublishedAggregates;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

import java.time.Clock;

// Only with publishing on, the same condition as OutboxAutoConfiguration: the backfill writes the outbox.
@Configuration(proxyBeanMethods = false)
@ConditionalOnBooleanProperty(name = {"spring.data.mongodb.enabled", "openframe.events.publishing.enabled"})
@Import(EventBackfillMetrics.class)
public class BackfillConfiguration {

    @Bean
    public EventBackfillRunner eventBackfillRunner(EventBackfillProperties properties, PublishedAggregates publishedAggregates,
                                                   EventJobService jobService, EventJobTicker<EventJob> ticker,
                                                   EventBackfillMetrics metrics) {
        return new EventBackfillRunner(properties, publishedAggregates, jobService, ticker, metrics);
    }

    @Bean
    public EventBackfillService eventBackfillService(PublishedAggregates publishedAggregates, EventJobService jobService,
                                                     EventBackfillRunner runner) {
        Clock clock = Clock.systemUTC();
        return new EventBackfillService(publishedAggregates, jobService, runner, clock);
    }

    @Bean
    public BackfillRunsStartupCheck backfillRunsStartupCheck(EventBackfillProperties properties, AggregateSpecRegistry specRegistry) {
        return new BackfillRunsStartupCheck(properties, specRegistry);
    }

    @Bean
    public EventBackfillJob eventBackfillJob(EventBackfillProperties properties, EventJobLock jobLock,
                                             EventBackfillService backfillService) {
        return new EventBackfillJob(properties, jobLock, backfillService);
    }
}
