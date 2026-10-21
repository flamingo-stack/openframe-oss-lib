package com.openframe.publishing.config;

import com.openframe.publishing.api.PublishedAggregateType;
import com.openframe.publishing.fixture.Widgets.WidgetSpec;
import com.openframe.publishing.spec.PublishedAggregateSpecRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;

// What the compiler cannot check is checked when the service starts.
class PublishedAggregateConfigurationTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(EventsConfiguration.class, PublishedAggregateSpecRegistry.class,
                    PublishedAggregateStartupCheck.class, PublishedAggregateTopics.class);

    @Test
    void aMistypedTopicKey_stopsTheServiceFromStarting() {
        runner.withPropertyValues("openframe.events.topics.organisations.publish=true")
                .run(context -> assertThat(context).hasFailed());
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
                    assertThat(topics.isPublishing(PublishedAggregateType.ORGANIZATIONS)).isTrue();
                });
    }

    @Test
    void publishOff_orNotConfigured_isNotPublishing() {
        runner.withBean(WidgetSpec.class)
                .withPropertyValues("openframe.events.topics.organizations.publish=false")
                .run(context -> {
                    PublishedAggregateTopics topics = context.getBean(PublishedAggregateTopics.class);
                    assertThat(topics.isPublishing(PublishedAggregateType.ORGANIZATIONS)).isFalse();
                });
        runner.run(context -> {
            PublishedAggregateTopics topics = context.getBean(PublishedAggregateTopics.class);
            assertThat(topics.isPublishing(PublishedAggregateType.ORGANIZATIONS)).isFalse();
        });
    }

    @Test
    void thePublishFlags_areCopiedAtStartup_soARebindOfThePropertiesDoesNotChangeThem() {
        runner.withBean(WidgetSpec.class)
                .withPropertyValues("openframe.events.topics.organizations.publish=false")
                .run(context -> {
                    EventsProperties properties = context.getBean(EventsProperties.class);
                    properties.getTopics().get(PublishedAggregateType.ORGANIZATIONS).setPublish(true);

                    PublishedAggregateTopics topics = context.getBean(PublishedAggregateTopics.class);
                    assertThat(topics.isPublishing(PublishedAggregateType.ORGANIZATIONS)).isFalse();
                });
    }
}
