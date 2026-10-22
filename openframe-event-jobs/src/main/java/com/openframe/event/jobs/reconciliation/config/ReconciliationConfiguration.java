package com.openframe.event.jobs.reconciliation.config;

import com.openframe.event.jobs.core.lock.EventJobLock;
import com.openframe.event.jobs.core.persistence.EventJob;
import com.openframe.event.jobs.core.service.EventJobService;
import com.openframe.event.jobs.core.service.EventJobTicker;
import com.openframe.event.jobs.reconciliation.config.properties.ReconciliationProperties;
import com.openframe.event.jobs.reconciliation.repository.ProjectedItemRepository;
import com.openframe.event.jobs.reconciliation.scheduler.ReconciliationJob;
import com.openframe.event.jobs.reconciliation.service.ReconciliationMetrics;
import com.openframe.event.jobs.reconciliation.service.ReconciliationRunner;
import com.openframe.event.jobs.reconciliation.service.ReconciliationService;
import com.openframe.publishing.api.spec.Projection;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

import java.time.Clock;
import java.util.List;

// Its own switch inside the module; it reconciles every projection of the service's aggregate specs.
@Configuration(proxyBeanMethods = false)
@ConditionalOnBooleanProperty(name = "openframe.events.jobs.reconciliation.enabled")
@Import(ProjectedItemRepository.class)
public class ReconciliationConfiguration {

    @Bean
    public ReconciliationMetrics reconciliationMetrics(MeterRegistry meterRegistry, AggregateSpecRegistry specRegistry) {
        List<Projection<?, ?>> projections = specRegistry.projections();
        return new ReconciliationMetrics(meterRegistry, projections);
    }

    @Bean
    public ReconciliationRunner reconciliationRunner(ReconciliationProperties properties, ProjectedItemRepository itemRepository,
                                                     EventJobService jobService, EventJobTicker<EventJob> ticker,
                                                     ReconciliationMetrics metrics) {
        return new ReconciliationRunner(properties, itemRepository, jobService, ticker, metrics);
    }

    @Bean
    public ReconciliationService reconciliationService(ReconciliationProperties properties, EventJobService jobService,
                                                       ReconciliationRunner runner, ReconciliationMetrics metrics) {
        Clock clock = Clock.systemUTC();
        return new ReconciliationService(properties, jobService, runner, metrics, clock);
    }

    @Bean
    public ReconciliationJob reconciliationJob(ReconciliationProperties properties, AggregateSpecRegistry specRegistry,
                                               EventJobLock jobLock, ReconciliationService reconciliationService) {
        List<Projection<?, ?>> projections = specRegistry.projections();
        return new ReconciliationJob(properties, projections, jobLock, reconciliationService);
    }
}
