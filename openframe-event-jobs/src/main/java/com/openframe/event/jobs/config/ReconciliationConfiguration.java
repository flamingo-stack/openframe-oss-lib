package com.openframe.event.jobs.config;

import com.openframe.event.jobs.config.properties.ReconciliationProperties;
import com.openframe.event.jobs.scheduler.ReconciliationJob;
import com.openframe.event.jobs.lock.EventJobLock;
import com.openframe.event.jobs.reconciliation.MappedCopies;
import com.openframe.event.jobs.reconciliation.MappedCopy;
import com.openframe.event.jobs.reconciliation.ReconciledCopy;
import com.openframe.event.jobs.reconciliation.ReconciledCopyMapper;
import com.openframe.event.jobs.reconciliation.ReconciliationMetrics;
import com.openframe.event.jobs.reconciliation.ReconciliationRunner;
import com.openframe.event.jobs.reconciliation.ReconciliationService;
import com.openframe.event.jobs.repository.ReconciledCopyRepository;
import com.openframe.event.jobs.service.EventJobService;
import com.openframe.event.jobs.service.EventJobTicker;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.core.MongoOperations;

import java.time.Clock;
import java.util.ArrayList;
import java.util.List;

// Its own switch inside the module; the copies are the service's ReconciledCopy beans.
@Configuration(proxyBeanMethods = false)
@ConditionalOnBooleanProperty(name = "openframe.events.jobs.reconciliation.enabled")
@Import(ReconciledCopyRepository.class)
public class ReconciliationConfiguration {

    // An unknown class or property in a copy stops the service here.
    @Bean
    public MappedCopies mappedCopies(ObjectProvider<ReconciledCopy> copies, MongoOperations mongoOperations) {
        ReconciledCopyMapper mapper = new ReconciledCopyMapper(mongoOperations);
        List<MappedCopy> mapped = new ArrayList<>();
        copies.orderedStream().forEach(copy -> {
            MappedCopy mappedCopy = mapper.toMappedCopy(copy);
            mapped.add(mappedCopy);
        });
        List<MappedCopy> resolved = List.copyOf(mapped);
        return new MappedCopies(resolved);
    }

    @Bean
    public ReconciliationMetrics reconciliationMetrics(MeterRegistry meterRegistry, MappedCopies mappedCopies) {
        List<MappedCopy> copies = mappedCopies.getCopies();
        return new ReconciliationMetrics(meterRegistry, copies);
    }

    @Bean
    public ReconciliationRunner reconciliationRunner(ReconciliationProperties properties, ReconciledCopyRepository copyRepository,
                                                     EventJobService jobService, EventJobTicker ticker,
                                                     ReconciliationMetrics metrics) {
        return new ReconciliationRunner(properties, copyRepository, jobService, ticker, metrics);
    }

    @Bean
    public ReconciliationService reconciliationService(ReconciliationProperties properties, EventJobService jobService,
                                                       ReconciliationRunner runner, ReconciliationMetrics metrics) {
        Clock clock = Clock.systemUTC();
        return new ReconciliationService(properties, jobService, runner, metrics, clock);
    }

    @Bean
    public ReconciliationJob reconciliationJob(ReconciliationProperties properties, MappedCopies mappedCopies,
                                               EventJobLock jobLock, ReconciliationService reconciliationService) {
        List<MappedCopy> copies = mappedCopies.getCopies();
        return new ReconciliationJob(properties, copies, jobLock, reconciliationService);
    }
}
