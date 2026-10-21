package com.openframe.processing.config;

import com.openframe.processing.api.EventProcessor;
import com.openframe.processing.listener.AggregateEventListener;
import com.openframe.processing.registry.EventProcessorRegistry;
import com.openframe.publishing.api.PublishedAggregateType;
import com.openframe.publishing.api.PublishedEvent;
import com.openframe.publishing.api.PublishedRecord;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import static org.assertj.core.api.Assertions.assertThat;

// Through EventProcessingAutoConfiguration, with the check built the way the Kafka auto-configuration builds it.
class EventListenerStartupCheckTest {

    private static final PublishedAggregateType ORGANIZATIONS = PublishedAggregateType.ORGANIZATIONS;

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(EventProcessingAutoConfiguration.class))
            .withPropertyValues("openframe.events.processing.enabled=true")
            .withBean(MeterRegistry.class, SimpleMeterRegistry::new)
            .withUserConfiguration(CheckConfiguration.class);

    @Test
    void aProcessorWhoseSourceHasNoListener_stopsTheServiceFromStarting() {
        runner.withBean("onTickets", EventProcessor.class, WidgetProcessor::new)
                .run(context -> assertThat(context).hasFailed()
                        .getFailure().hasMessageContaining("[organizations]"));
    }

    @Test
    void aProcessorWithAListenerForItsSource_starts() {
        runner.withBean("onTickets", EventProcessor.class, WidgetProcessor::new)
                .withBean("organizationListener", AggregateEventListener.class, () -> () -> ORGANIZATIONS)
                .run(context -> assertThat(context).hasNotFailed());
    }

    @Test
    void aServiceWithoutProcessors_startsWithoutListeners() {
        runner.run(context -> assertThat(context).hasNotFailed());
    }

    @Configuration
    static class CheckConfiguration {

        @Bean
        EventListenerStartupCheck eventListenerStartupCheck(EventProcessorRegistry registry,
                                                            ObjectProvider<AggregateEventListener> listeners) {
            return new EventListenerStartupCheck(registry, listeners);
        }
    }

    static class WidgetEvent implements PublishedEvent {
    }

    static class WidgetProcessor implements EventProcessor<WidgetEvent> {

        @Override
        public String name() {
            return "widget-on-tickets";
        }

        @Override
        public PublishedAggregateType getType() {
            return ORGANIZATIONS;
        }

        @Override
        public long process(PublishedRecord<WidgetEvent> record) {
            return 0;
        }
    }
}
