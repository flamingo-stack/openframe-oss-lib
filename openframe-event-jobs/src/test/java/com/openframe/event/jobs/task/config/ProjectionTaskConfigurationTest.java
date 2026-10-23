package com.openframe.event.jobs.task.config;

import com.openframe.event.jobs.core.lock.EventJobLock;
import com.openframe.event.jobs.core.service.EventJobShutdown;
import com.openframe.event.jobs.task.config.properties.ProjectionTaskProperties;
import com.openframe.event.jobs.task.fixture.Widgets;
import com.openframe.event.jobs.task.fixture.Widgets.WidgetEvent;
import com.openframe.event.jobs.task.repository.ProjectionTaskRepository;
import com.openframe.event.jobs.task.scheduler.ProjectionTaskJob;
import com.openframe.publishing.api.spec.Projection;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ProjectionTaskConfigurationTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(ProjectionTaskConfiguration.class, ProjectionTaskPropertiesConfiguration.class)
            .withBean(MeterRegistry.class, SimpleMeterRegistry::new)
            .withBean(AggregateSpecRegistry.class, ProjectionTaskConfigurationTest::specRegistry)
            .withBean(ProjectionTaskRepository.class, () -> mock(ProjectionTaskRepository.class))
            .withBean(EventJobShutdown.class, EventJobShutdown::new)
            .withBean(EventJobLock.class, () -> mock(EventJobLock.class));

    @Test
    void projectionTasks_areOffByDefault() {
        runner.run(context -> assertThat(context).doesNotHaveBean(ProjectionTaskJob.class));
    }

    @Test
    void theirSwitch_createsTheJob_withMetersPerProjection() {
        runner.withPropertyValues("openframe.events.jobs.projection-tasks.enabled=true")
                .run(context -> {
                    assertThat(context).hasSingleBean(ProjectionTaskJob.class);
                    MeterRegistry meterRegistry = context.getBean(MeterRegistry.class);
                    assertThat(meterRegistry.find("openframe.events.projection.tasks.open")
                            .tag("projection", "widget-copies").gauge()).isNotNull();
                    assertThat(meterRegistry.find("openframe.events.projection.tasks.failed")
                            .tag("projection", "widget-copies").counter()).isNotNull();
                });
    }

    @SuppressWarnings("unchecked")
    private static AggregateSpecRegistry specRegistry() {
        Projection<WidgetEvent, Object> projection = mock(Projection.class);
        when(projection.name()).thenReturn("widget-copies");
        return Widgets.registryWith(projection);
    }

    @EnableConfigurationProperties(ProjectionTaskProperties.class)
    static class ProjectionTaskPropertiesConfiguration {
    }
}
