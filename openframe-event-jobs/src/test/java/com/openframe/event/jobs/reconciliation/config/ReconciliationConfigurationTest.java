package com.openframe.event.jobs.reconciliation.config;

import com.openframe.event.jobs.core.lock.EventJobLock;
import com.openframe.event.jobs.core.service.EventJobService;
import com.openframe.event.jobs.core.service.EventJobTicker;
import com.openframe.event.jobs.reconciliation.config.properties.ReconciliationProperties;
import com.openframe.event.jobs.reconciliation.scheduler.ReconciliationJob;
import com.openframe.publishing.api.spec.Projection;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.data.mongodb.core.MongoOperations;

import java.util.List;

import static com.openframe.event.jobs.reconciliation.fixture.Projections.named;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ReconciliationConfigurationTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(ReconciliationConfiguration.class, ReconciliationPropertiesConfiguration.class)
            .withBean(MeterRegistry.class, SimpleMeterRegistry::new)
            .withBean(MongoOperations.class, () -> mock(MongoOperations.class))
            .withBean(AggregateSpecRegistry.class, ReconciliationConfigurationTest::specRegistry)
            .withBean(EventJobService.class, () -> mock(EventJobService.class))
            .withBean(EventJobLock.class, () -> mock(EventJobLock.class))
            .withBean(EventJobTicker.class, () -> mock(EventJobTicker.class));

    @Test
    void reconciliation_isOffByDefault() {
        runner.run(context -> assertThat(context).doesNotHaveBean(ReconciliationJob.class));
    }

    @Test
    void itsSwitch_createsTheJob_withAGaugePerProjection() {
        runner.withPropertyValues("openframe.events.jobs.reconciliation.enabled=true")
                .run(context -> {
                    assertThat(context).hasSingleBean(ReconciliationJob.class);
                    MeterRegistry meterRegistry = context.getBean(MeterRegistry.class);
                    assertThat(meterRegistry.find("openframe.events.reconciliation.mismatches")
                            .tag("projection", "organization-on-tickets").gauge()).isNotNull();
                });
    }

    private static AggregateSpecRegistry specRegistry() {
        AggregateSpecRegistry specRegistry = mock(AggregateSpecRegistry.class);
        List<Projection<?, ?>> projections = List.of(named("organization-on-tickets"));
        when(specRegistry.projections()).thenReturn(projections);
        return specRegistry;
    }

    @EnableConfigurationProperties(ReconciliationProperties.class)
    static class ReconciliationPropertiesConfiguration {
    }
}
