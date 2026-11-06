package com.openframe.event.jobs.task.config;

import com.openframe.event.jobs.core.lock.EventJobLock;
import com.openframe.event.jobs.core.service.EventJobShutdown;
import com.openframe.event.jobs.core.service.EventJobTicker;
import com.openframe.event.jobs.task.config.properties.ProjectionTaskProperties;
import com.openframe.event.jobs.task.persistence.ProjectionTask;
import com.openframe.event.jobs.task.repository.ProjectionTaskRepository;
import com.openframe.event.jobs.task.scheduler.ProjectionTaskJob;
import com.openframe.event.jobs.task.service.ProjectionTaskEnvelopes;
import com.openframe.event.jobs.task.service.ProjectionTaskMetrics;
import com.openframe.event.jobs.task.service.ProjectionTaskRunner;
import com.openframe.event.jobs.task.service.ProjectionTaskService;
import com.openframe.publishing.api.spec.Projection;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.util.List;

// It works the large updates of every projection of the service's aggregate specs.
@Configuration(proxyBeanMethods = false)
public class ProjectionTaskConfiguration {

    @Bean
    public ProjectionTaskEnvelopes projectionTaskEnvelopes(AggregateSpecRegistry specRegistry) {
        return new ProjectionTaskEnvelopes(specRegistry);
    }

    @Bean
    public ProjectionTaskService projectionTaskService(ProjectionTaskRepository taskRepository,
                                                       ProjectionTaskEnvelopes envelopes) {
        Clock clock = Clock.systemUTC();
        return new ProjectionTaskService(taskRepository, envelopes, clock);
    }

    @Bean
    public ProjectionTaskMetrics projectionTaskMetrics(MeterRegistry meterRegistry, AggregateSpecRegistry specRegistry) {
        List<Projection<?, ?>> projections = specRegistry.projections();
        return new ProjectionTaskMetrics(meterRegistry, projections);
    }

    // Its own ticker, not a bean: the runs' EventJobTicker<EventJob> bean stays the only one of its type.
    @Bean
    public ProjectionTaskRunner projectionTaskRunner(ProjectionTaskProperties properties, AggregateSpecRegistry specRegistry,
                                                     ProjectionTaskService taskService, ProjectionTaskEnvelopes envelopes,
                                                     EventJobShutdown shutdown, ProjectionTaskMetrics metrics) {
        Clock clock = Clock.systemUTC();
        EventJobTicker<ProjectionTask> ticker = new EventJobTicker<>(taskService, shutdown, clock);
        List<Projection<?, ?>> projections = specRegistry.projections();
        return new ProjectionTaskRunner(properties, projections, taskService, envelopes, ticker, metrics);
    }

    @Bean
    public ProjectionTaskJob projectionTaskJob(ProjectionTaskProperties properties, AggregateSpecRegistry specRegistry,
                                               EventJobLock jobLock, ProjectionTaskService taskService,
                                               ProjectionTaskRunner runner) {
        List<Projection<?, ?>> projections = specRegistry.projections();
        return new ProjectionTaskJob(properties, projections, jobLock, taskService, runner);
    }
}
