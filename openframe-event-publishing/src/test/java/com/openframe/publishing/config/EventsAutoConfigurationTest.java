package com.openframe.publishing.config;

import com.openframe.publishing.registry.AggregateSpecRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;

class EventsAutoConfigurationTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(AggregateSpecAutoConfiguration.class, EventsAutoConfiguration.class,
                    OutboxAutoConfiguration.class));

    @Test
    void aServiceWithoutMongo_hasTheSwitches_soItsAspectsStart() {
        runner.run(context -> assertThat(context).hasNotFailed()
                .hasSingleBean(PublishedAggregateTopics.class)
                .doesNotHaveBean(AggregateSpecRegistry.class));
    }
}
