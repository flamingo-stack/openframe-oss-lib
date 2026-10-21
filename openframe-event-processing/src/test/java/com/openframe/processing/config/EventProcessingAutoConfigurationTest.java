package com.openframe.processing.config;

import com.openframe.processing.api.EventProcessor;
import com.openframe.processing.config.properties.EventProcessingKafkaProperties;
import com.openframe.processing.config.properties.ProcessingModeProperties;
import com.openframe.processing.mode.ProcessingMode;
import com.openframe.processing.mode.ProcessingModes;
import com.openframe.processing.registry.EventProcessorRegistry;
import com.openframe.publishing.api.PublishedAggregateType;
import com.openframe.publishing.api.PublishedEvent;
import com.openframe.publishing.api.PublishedRecord;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.FilterType;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

// Through EventProcessingAutoConfiguration, as a service loads it.
@ExtendWith(OutputCaptureExtension.class)
class EventProcessingAutoConfigurationTest {

    private static final PublishedAggregateType ORGANIZATIONS = PublishedAggregateType.ORGANIZATIONS;

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(EventProcessingAutoConfiguration.class))
            .withPropertyValues("openframe.events.processing.enabled=true")
            .withBean(MeterRegistry.class, SimpleMeterRegistry::new);

    @Test
    void eventProcessing_isOffByDefault_soNoneOfItsBeansExist() {
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(EventProcessingAutoConfiguration.class))
                .withBean(MeterRegistry.class, SimpleMeterRegistry::new)
                .run(context -> assertThat(context).hasNotFailed()
                        .doesNotHaveBean(EventProcessorRegistry.class)
                        .doesNotHaveBean(EventProcessingKafkaProperties.class));
    }

    @Test
    void aServiceThatScansAllOfComOpenframe_stillStarts_withProcessingOff() {
        new ApplicationContextRunner()
                .withUserConfiguration(ScansEverything.class)
                .withBean(MeterRegistry.class, SimpleMeterRegistry::new)
                .run(context -> assertThat(context).hasNotFailed()
                        .doesNotHaveBean(EventProcessorRegistry.class));
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
    void aServiceWithoutProcessors_starts() {
        runner.run(context -> {
            assertThat(context).hasNotFailed();
            EventProcessorRegistry registry = context.getBean(EventProcessorRegistry.class);
            assertThat(registry.processorsOf(ORGANIZATIONS)).isEmpty();
            assertThat(registry.names()).isEmpty();
        });
    }

    @Test
    void theProcessorsOfASource_areGroupedForItsTopic() {
        runner.withBean("onTickets", EventProcessor.class, () -> new WidgetProcessor("widget-on-tickets"))
                .withBean("onIndex", EventProcessor.class, () -> new WidgetProcessor("widget-on-index"))
                .run(context -> {
                    EventProcessorRegistry registry = context.getBean(EventProcessorRegistry.class);
                    assertThat(registry.processorsOf(ORGANIZATIONS)).extracting(EventProcessor::name)
                            .containsExactlyInAnyOrder("widget-on-tickets", "widget-on-index");
                    assertThat(registry.contains("widget-on-tickets")).isTrue();
                });
    }

    @Test
    void twoProcessorsWithOneName_stopTheServiceFromStarting() {
        runner.withBean("first", EventProcessor.class, () -> new WidgetProcessor("widget-on-tickets"))
                .withBean("second", EventProcessor.class, () -> new WidgetProcessor("widget-on-tickets"))
                .run(context -> assertThat(context).hasFailed());
    }

    @Test
    void aProcessorIsOnAspectByDefault_andRunsOnBothAndOnEvents() {
        runner.withBean("onTickets", EventProcessor.class, () -> new WidgetProcessor("widget-on-tickets"))
                .withBean("onIndex", EventProcessor.class, () -> new WidgetProcessor("widget-on-index"))
                .withBean("onSearch", EventProcessor.class, () -> new WidgetProcessor("widget-on-search"))
                .withPropertyValues("openframe.events.processing.processors.widget-on-tickets.mode=events",
                        "openframe.events.processing.processors.widget-on-search.mode=both")
                .run(context -> {
                    ProcessingModes modes = context.getBean(ProcessingModes.class);
                    assertThat(modes.runsProcessor("widget-on-tickets")).isTrue();
                    assertThat(modes.runsProcessor("widget-on-search")).isTrue();
                    assertThat(modes.runsProcessor("widget-on-index")).isFalse();
                });
    }

    @Test
    void theModes_areCopiedAtStartup_soARebindOfThePropertiesDoesNotChangeThem() {
        runner.withBean("onTickets", EventProcessor.class, () -> new WidgetProcessor("widget-on-tickets"))
                .withPropertyValues("openframe.events.processing.processors.widget-on-tickets.mode=events")
                .run(context -> {
                    ProcessingModeProperties properties = context.getBean(ProcessingModeProperties.class);
                    properties.getProcessors().get("widget-on-tickets").setMode(ProcessingMode.ASPECT);

                    ProcessingModes modes = context.getBean(ProcessingModes.class);
                    assertThat(modes.runsProcessor("widget-on-tickets")).isTrue();
                });
    }

    @Test
    void aModeForAnUnknownProcessor_logsAnError_butStarts_soARolledBackImageStillRuns(CapturedOutput output) {
        runner.withBean("onTickets", EventProcessor.class, () -> new WidgetProcessor("widget-on-tickets"))
                .withPropertyValues("openframe.events.processing.processors.widget-on-ticket.mode=events")
                .run(context -> assertThat(context).hasNotFailed());

        assertThat(output).contains("ERROR").contains("[widget-on-ticket]");
    }

    @Test
    void aMistypedMode_stopsTheServiceFromStarting() {
        runner.withBean("onTickets", EventProcessor.class, () -> new WidgetProcessor("widget-on-tickets"))
                .withPropertyValues("openframe.events.processing.processors.widget-on-tickets.mode=event")
                .run(context -> assertThat(context).hasFailed());
    }

    // Like InternalApiApplication and WebhookApplication in saas-shared.
    @Configuration
    @ComponentScan(basePackages = "com.openframe.processing",
            excludeFilters = @ComponentScan.Filter(type = FilterType.REGEX, pattern = ".*(Test|IT)(\\$.*)?"))
    static class ScansEverything {
    }

    static class WidgetEvent implements PublishedEvent {
    }

    static class WidgetProcessor implements EventProcessor<WidgetEvent> {

        private final String name;

        WidgetProcessor(String name) {
            this.name = name;
        }

        @Override
        public String name() {
            return name;
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
