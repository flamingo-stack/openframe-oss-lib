package com.openframe.processing.config;

import com.openframe.processing.fixture.Widgets.RecordingProjection;
import com.openframe.processing.fixture.Widgets.WidgetSpec;
import com.openframe.processing.topic.EventTopicCreator;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

// Without a broker: the switch, and the settings a creator cannot start without.
class EventTopicsAutoConfigurationTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(EventTopicsAutoConfiguration.class))
            .withUserConfiguration(AggregateSpecRegistry.class)
            .withBean(WidgetSpec.class, () -> new WidgetSpec(List.of(new RecordingProjection("widget-on-organizations"))));

    @Test
    void topicCreation_isOffByDefault() {
        runner.withPropertyValues("openframe.events.processing.kafka.bootstrap-servers=localhost:9092",
                        "openframe.events.processing.kafka.topic-prefix=events.")
                .run(context -> assertThat(context).hasNotFailed().doesNotHaveBean(EventTopicCreator.class));
    }

    @Test
    void aMissingBootstrapServers_stopsTheService() {
        runner.withPropertyValues("openframe.events.enabled=true",
                        "openframe.events.processing.kafka.topic-prefix=events.")
                .run(context -> assertThat(context).hasFailed().getFailure()
                        .hasStackTraceContaining("bootstrap-servers is required when openframe.events.enabled is on"));
    }

    @Test
    void aMissingTopicPrefix_stopsTheService() {
        runner.withPropertyValues("openframe.events.enabled=true",
                        "openframe.events.processing.kafka.bootstrap-servers=localhost:9092")
                .run(context -> assertThat(context).hasFailed().getFailure()
                        .hasStackTraceContaining("openframe.events.processing.kafka.topic-prefix is required"));
    }
}
