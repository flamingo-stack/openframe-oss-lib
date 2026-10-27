package com.openframe.processing.config;

import com.openframe.processing.config.properties.EventProcessingKafkaProperties;
import com.openframe.processing.runner.ProjectionRunner;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.FilterType;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

// Through EventProcessingAutoConfiguration, as a service loads it.
class EventProcessingAutoConfigurationTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(EventProcessingAutoConfiguration.class))
            .withUserConfiguration(AggregateSpecRegistry.class)
            .withPropertyValues("openframe.events.enabled=true")
            .withBean(MeterRegistry.class, SimpleMeterRegistry::new)
            .withBean(MongoOperations.class, () -> mock(MongoOperations.class))
            .withBean(MongoDatabaseFactory.class, () -> mock(MongoDatabaseFactory.class));

    @Test
    void eventProcessing_isOffByDefault_soNoneOfItsBeansExist() {
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(EventProcessingAutoConfiguration.class))
                .withBean(MeterRegistry.class, SimpleMeterRegistry::new)
                .withBean(MongoOperations.class, () -> mock(MongoOperations.class))
                .withBean(MongoDatabaseFactory.class, () -> mock(MongoDatabaseFactory.class))
                .run(context -> assertThat(context).hasNotFailed()
                        .doesNotHaveBean(ProjectionRunner.class)
                        .doesNotHaveBean(EventProcessingKafkaProperties.class));
    }

    @Test
    void aServiceThatScansAllOfComOpenframe_stillStarts_withProcessingOff() {
        new ApplicationContextRunner()
                .withUserConfiguration(ScansEverything.class)
                .withBean(MeterRegistry.class, SimpleMeterRegistry::new)
                .withBean(MongoOperations.class, () -> mock(MongoOperations.class))
                .withBean(MongoDatabaseFactory.class, () -> mock(MongoDatabaseFactory.class))
                .run(context -> assertThat(context).hasNotFailed()
                        .doesNotHaveBean(ProjectionRunner.class));
    }

    @Test
    void theMongoBackOff_takesItsIntervalsFromConfig() {
        runner.withPropertyValues("openframe.events.processing.kafka.back-off.initial-interval=2s",
                        "openframe.events.processing.kafka.back-off.max-interval=1m",
                        "openframe.events.processing.kafka.back-off.multiplier=3")
                .run(context -> {
                    EventProcessingKafkaProperties properties = context.getBean(EventProcessingKafkaProperties.class);
                    EventProcessingKafkaProperties.BackOff backOff = properties.getKafka().getBackOff();
                    assertThat(backOff.getInitialInterval()).isEqualTo(Duration.ofSeconds(2));
                    assertThat(backOff.getMaxInterval()).isEqualTo(Duration.ofMinutes(1));
                    assertThat(backOff.getMultiplier()).isEqualTo(3.0);
                });
    }

    @Test
    void aServiceWithoutSpecs_starts() {
        runner.run(context -> assertThat(context).hasNotFailed().hasSingleBean(ProjectionRunner.class));
    }

    // Like InternalApiApplication and WebhookApplication in saas-shared.
    @Configuration
    @ComponentScan(basePackages = "com.openframe.processing",
            excludeFilters = @ComponentScan.Filter(type = FilterType.REGEX, pattern = ".*(Test|IT)(\\$.*)?"))
    static class ScansEverything {
    }
}
