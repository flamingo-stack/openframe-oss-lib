package com.openframe.event.jobs.backfill.config;

import com.openframe.event.jobs.backfill.config.properties.EventBackfillProperties;
import com.openframe.event.jobs.backfill.scheduler.EventBackfillJob;
import com.openframe.event.jobs.core.lock.EventJobLock;
import com.openframe.event.jobs.core.service.EventJobService;
import com.openframe.event.jobs.core.service.EventJobTicker;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import com.openframe.publishing.registry.PublishedAggregates;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class BackfillConfigurationTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(BackfillConfiguration.class, BackfillWithoutPublishingWarning.class,
                    BackfillPropertiesConfiguration.class)
            .withBean(MeterRegistry.class, SimpleMeterRegistry::new)
            .withBean(EventJobService.class, () -> mock(EventJobService.class))
            .withBean(EventJobTicker.class, () -> mock(EventJobTicker.class))
            .withBean(EventJobLock.class, () -> mock(EventJobLock.class));

    @Test
    void withoutPublishing_theJobsStartWithoutTheBackfill() {
        runner.withPropertyValues("openframe.events.jobs.backfill.runs.organizations=run-1")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).doesNotHaveBean(EventBackfillJob.class);
                    assertThat(context).hasSingleBean(BackfillWithoutPublishingWarning.class);
                });
    }

    @Test
    void withPublishing_theBackfillIsCreated() {
        runner.withPropertyValues("spring.data.mongodb.enabled=true", "openframe.events.publishing.enabled=true")
                .withBean(PublishedAggregates.class, () -> mock(PublishedAggregates.class))
                .withBean(AggregateSpecRegistry.class, () -> mock(AggregateSpecRegistry.class))
                .run(context -> {
                    assertThat(context).hasSingleBean(EventBackfillJob.class);
                    assertThat(context).hasSingleBean(BackfillRunsStartupCheck.class);
                    assertThat(context).doesNotHaveBean(BackfillWithoutPublishingWarning.class);
                });
    }

    @Test
    void anInvalidBatchSize_stopsTheService() {
        runner.withPropertyValues("openframe.events.jobs.backfill.batch-size=0")
                .run(context -> assertThat(context).hasFailed());
    }

    @EnableConfigurationProperties(EventBackfillProperties.class)
    static class BackfillPropertiesConfiguration {
    }
}
