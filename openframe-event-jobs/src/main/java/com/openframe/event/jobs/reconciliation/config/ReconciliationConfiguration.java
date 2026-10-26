package com.openframe.event.jobs.reconciliation.config;

import com.openframe.event.jobs.core.lock.EventJobLock;
import com.openframe.event.jobs.core.service.EventJobService;
import com.openframe.event.jobs.core.service.EventJobTicker;
import com.openframe.event.jobs.reconciliation.config.properties.ReconciliationProperties;
import com.openframe.event.jobs.reconciliation.repository.ProjectedItemRepository;
import com.openframe.event.jobs.reconciliation.scheduler.ReconciliationJob;
import com.openframe.event.jobs.reconciliation.service.ReconciliationMetrics;
import com.openframe.event.jobs.reconciliation.service.ReconciliationRunner;
import com.openframe.event.jobs.reconciliation.service.ReconciliationService;
import com.openframe.publishing.api.spec.Projection;
import com.openframe.publishing.config.PublishedAggregateTopics;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import com.openframe.publishing.registry.PublishedAggregates;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

import java.time.Clock;
import java.util.ArrayList;
import java.util.List;

// It reconciles the projections of the types switched on in this service.
@Configuration(proxyBeanMethods = false)
@Import(ProjectedItemRepository.class)
public class ReconciliationConfiguration {

    @Bean
    public ReconciliationMetrics reconciliationMetrics(MeterRegistry meterRegistry, AggregateSpecRegistry specRegistry,
                                                       PublishedAggregateTopics publishedTopics) {
        List<Projection<?, ?>> projections = projectionsOfEnabledTypes(specRegistry, publishedTopics);
        return new ReconciliationMetrics(meterRegistry, projections);
    }

    @Bean
    public ReconciliationRunner reconciliationRunner(ReconciliationProperties properties, ProjectedItemRepository itemRepository,
                                                     EventJobService jobService, EventJobTicker ticker,
                                                     ReconciliationMetrics metrics, AggregateSpecRegistry specRegistry,
                                                     PublishedAggregates publishedAggregates) {
        return new ReconciliationRunner(properties, itemRepository, jobService, ticker, metrics, specRegistry,
                publishedAggregates);
    }

    @Bean
    public ReconciliationService reconciliationService(ReconciliationProperties properties, EventJobService jobService,
                                                       ReconciliationRunner runner, ReconciliationMetrics metrics) {
        Clock clock = Clock.systemUTC();
        return new ReconciliationService(properties, jobService, runner, metrics, clock);
    }

    @Bean
    public ReconciliationJob reconciliationJob(ReconciliationProperties properties, AggregateSpecRegistry specRegistry,
                                               PublishedAggregateTopics publishedTopics, EventJobLock jobLock,
                                               ReconciliationService reconciliationService) {
        List<Projection<?, ?>> projections = projectionsOfEnabledTypes(specRegistry, publishedTopics);
        return new ReconciliationJob(properties, projections, jobLock, reconciliationService);
    }

    // A type switched off has no running projections: its copies are still the aspects', so they are not checked.
    private static List<Projection<?, ?>> projectionsOfEnabledTypes(AggregateSpecRegistry specRegistry,
                                                                    PublishedAggregateTopics publishedTopics) {
        List<Projection<?, ?>> projections = new ArrayList<>();
        for (String type : specRegistry.types()) {
            if (publishedTopics.isPublishing(type)) {
                List<? extends Projection<?, ?>> typeProjections = specRegistry.specOf(type).projections();
                projections.addAll(typeProjections);
            }
        }
        return projections;
    }
}
