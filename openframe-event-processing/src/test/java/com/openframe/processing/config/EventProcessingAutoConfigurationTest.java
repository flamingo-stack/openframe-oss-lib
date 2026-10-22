package com.openframe.processing.config;

import com.openframe.processing.config.properties.EventProcessingKafkaProperties;
import com.openframe.processing.config.properties.ProcessingModeProperties;
import com.openframe.processing.fixture.Widgets.RecordingProjection;
import com.openframe.processing.fixture.Widgets.WidgetEvent;
import com.openframe.processing.fixture.Widgets.WidgetSpec;
import com.openframe.processing.mode.ProcessingMode;
import com.openframe.processing.mode.ProcessingModes;
import com.openframe.processing.runner.ProjectionRunner;
import com.openframe.publishing.api.spec.Projection;
import com.openframe.publishing.registry.AggregateSpecRegistry;
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
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

// Through EventProcessingAutoConfiguration, as a service loads it.
@ExtendWith(OutputCaptureExtension.class)
class EventProcessingAutoConfigurationTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(EventProcessingAutoConfiguration.class))
            .withUserConfiguration(AggregateSpecRegistry.class)
            .withPropertyValues("openframe.events.processing.enabled=true")
            .withBean(MeterRegistry.class, SimpleMeterRegistry::new);

    @Test
    void eventProcessing_isOffByDefault_soNoneOfItsBeansExist() {
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(EventProcessingAutoConfiguration.class))
                .withBean(MeterRegistry.class, SimpleMeterRegistry::new)
                .run(context -> assertThat(context).hasNotFailed()
                        .doesNotHaveBean(ProjectionRunner.class)
                        .doesNotHaveBean(EventProcessingKafkaProperties.class));
    }

    @Test
    void aServiceThatScansAllOfComOpenframe_stillStarts_withProcessingOff() {
        new ApplicationContextRunner()
                .withUserConfiguration(ScansEverything.class)
                .withBean(MeterRegistry.class, SimpleMeterRegistry::new)
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

    @Test
    void aProjectionIsOnAspectByDefault_andRunsOnBothAndOnEvents() {
        withProjections("widget-on-tickets", "widget-on-index", "widget-on-search")
                .withPropertyValues("openframe.events.processing.projections.widget-on-tickets.mode=events",
                        "openframe.events.processing.projections.widget-on-search.mode=both")
                .run(context -> {
                    ProcessingModes modes = context.getBean(ProcessingModes.class);
                    assertThat(modes.runsProjection("widget-on-tickets")).isTrue();
                    assertThat(modes.runsProjection("widget-on-search")).isTrue();
                    assertThat(modes.runsProjection("widget-on-index")).isFalse();
                });
    }

    @Test
    void theModes_areCopiedAtStartup_soARebindOfThePropertiesDoesNotChangeThem() {
        withProjections("widget-on-tickets")
                .withPropertyValues("openframe.events.processing.projections.widget-on-tickets.mode=events")
                .run(context -> {
                    ProcessingModeProperties properties = context.getBean(ProcessingModeProperties.class);
                    properties.getProjections().get("widget-on-tickets").setMode(ProcessingMode.ASPECT);

                    ProcessingModes modes = context.getBean(ProcessingModes.class);
                    assertThat(modes.runsProjection("widget-on-tickets")).isTrue();
                });
    }

    @Test
    void aModeForAnUnknownProjection_logsAnError_butStarts_soARolledBackImageStillRuns(CapturedOutput output) {
        withProjections("widget-on-tickets")
                .withPropertyValues("openframe.events.processing.projections.widget-on-ticket.mode=events")
                .run(context -> assertThat(context).hasNotFailed());

        assertThat(output).contains("ERROR").contains("[widget-on-ticket]");
    }

    @Test
    void aMistypedMode_stopsTheServiceFromStarting() {
        withProjections("widget-on-tickets")
                .withPropertyValues("openframe.events.processing.projections.widget-on-tickets.mode=event")
                .run(context -> assertThat(context).hasFailed());
    }

    private ApplicationContextRunner withProjections(String... names) {
        List<Projection<WidgetEvent, ?>> projections = List.of(names).stream()
                .<Projection<WidgetEvent, ?>>map(RecordingProjection::new)
                .toList();
        return runner.withBean(WidgetSpec.class, () -> new WidgetSpec(projections));
    }

    // Like InternalApiApplication and WebhookApplication in saas-shared.
    @Configuration
    @ComponentScan(basePackages = "com.openframe.processing",
            excludeFilters = @ComponentScan.Filter(type = FilterType.REGEX, pattern = ".*(Test|IT)(\\$.*)?"))
    static class ScansEverything {
    }
}
