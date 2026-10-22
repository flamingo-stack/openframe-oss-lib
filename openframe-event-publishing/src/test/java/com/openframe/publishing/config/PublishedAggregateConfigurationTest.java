package com.openframe.publishing.config;

import com.openframe.publishing.fixture.Widgets.WidgetSpec;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;

import static org.assertj.core.api.Assertions.assertThat;

// What the compiler cannot check is checked when the service starts.
@ExtendWith(OutputCaptureExtension.class)
class PublishedAggregateConfigurationTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(EventsConfiguration.class, AggregateSpecRegistry.class,
                    PublishedAggregateStartupCheck.class, PublishedAggregateTopics.class);

    @Test
    void aMistypedTopicKeyWithPublishOn_stopsTheServiceFromStarting() {
        runner.withBean(WidgetSpec.class)
                .withPropertyValues("openframe.events.topics.organisations.publish=true")
                .run(context -> assertThat(context).hasFailed()
                        .getFailure().hasMessageContaining("[organisations]").hasMessageContaining("[organizations]"));
    }

    @Test
    void aMistypedTopicKeyWithPublishOff_logsAWarn_butStarts_soARolledBackImageStillRuns(CapturedOutput output) {
        runner.withBean(WidgetSpec.class)
                .withPropertyValues("openframe.events.topics.organisations.publish=false")
                .run(context -> assertThat(context).hasNotFailed());

        assertThat(output).contains("WARN").contains("openframe.events.topics names [organisations]");
    }

    @Test
    void publishOnForATypeWithoutASpec_stopsTheServiceFromStarting() {
        runner.withPropertyValues("openframe.events.topics.organizations.publish=true")
                .run(context -> assertThat(context).hasFailed()
                        .getFailure().hasMessageContaining("organizations"));
    }

    @Test
    void publishOnForATypeWithASpec_starts() {
        runner.withBean(WidgetSpec.class)
                .withPropertyValues("openframe.events.topics.organizations.publish=true")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    PublishedAggregateTopics topics = context.getBean(PublishedAggregateTopics.class);
                    assertThat(topics.isPublishing("organizations")).isTrue();
                });
    }

    @Test
    void publishOff_orNotConfigured_isNotPublishing() {
        runner.withBean(WidgetSpec.class)
                .withPropertyValues("openframe.events.topics.organizations.publish=false")
                .run(context -> {
                    PublishedAggregateTopics topics = context.getBean(PublishedAggregateTopics.class);
                    assertThat(topics.isPublishing("organizations")).isFalse();
                });
        runner.run(context -> {
            PublishedAggregateTopics topics = context.getBean(PublishedAggregateTopics.class);
            assertThat(topics.isPublishing("organizations")).isFalse();
        });
    }

    @Test
    void thePublishFlags_areCopiedAtStartup_soARebindOfThePropertiesDoesNotChangeThem() {
        runner.withBean(WidgetSpec.class)
                .withPropertyValues("openframe.events.topics.organizations.publish=false")
                .run(context -> {
                    EventsProperties properties = context.getBean(EventsProperties.class);
                    properties.getTopics().get("organizations").setPublish(true);

                    PublishedAggregateTopics topics = context.getBean(PublishedAggregateTopics.class);
                    assertThat(topics.isPublishing("organizations")).isFalse();
                });
    }
}
