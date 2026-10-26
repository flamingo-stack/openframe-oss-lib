package com.openframe.processing.config;

import com.openframe.processing.exception.EventProcessingFailedException;
import com.openframe.processing.exception.MongoUnavailableException;
import com.openframe.processing.fixture.Widgets.RecordingProjection;
import com.openframe.processing.fixture.Widgets.WidgetSpec;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.apache.kafka.common.serialization.ByteArrayDeserializer;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.context.PropertyPlaceholderAutoConfiguration;
import org.springframework.boot.kafka.autoconfigure.KafkaAutoConfiguration;
import org.springframework.boot.test.context.assertj.AssertableApplicationContext;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.config.KafkaListenerEndpointRegistry;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.ConcurrentMessageListenerContainer;
import org.springframework.kafka.listener.ContainerProperties;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.kafka.listener.MessageListenerContainer;

import java.util.Collection;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class EventProcessingKafkaAutoConfigurationTest {

    private static final String ORGANIZATIONS = "organizations";

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(PropertyPlaceholderAutoConfiguration.class, KafkaAutoConfiguration.class,
                    EventProcessingAutoConfiguration.class, EventProcessingKafkaAutoConfiguration.class))
            .withUserConfiguration(AggregateSpecRegistry.class)
            .withBean(WidgetSpec.class, EventProcessingKafkaAutoConfigurationTest::widgetSpec)
            .withPropertyValues("openframe.events.enabled=true",
                    "openframe.events.processing.kafka.bootstrap-servers=localhost:9092",
                    "openframe.events.processing.kafka.topic-prefix=events.",
                    "openframe.events.processing.kafka.group-prefix=openframe-saas-stream.processing-",
                    "openframe.events.processing.kafka.listener.auto-startup=false")
            .withBean(MeterRegistry.class, SimpleMeterRegistry::new)
            .withBean(MongoOperations.class, () -> mock(MongoOperations.class));

    @Test
    void theProjectionConsumer_readsFromEarliest_inSmallPolls_byDefault() {
        runner.run(context -> {
            Map<String, Object> consumer = projectionConsumerOf(context);
            assertThat(consumer).containsEntry("auto.offset.reset", "earliest").containsEntry("max.poll.records", 20);
            assertThat(consumer.get("value.deserializer")).isEqualTo(ByteArrayDeserializer.class);
        });
    }

    @Test
    void theProjectionConsumer_takesItsOwnClusterAndSettings_notTheServicesSpringKafka() {
        runner.withPropertyValues("openframe.events.processing.kafka.bootstrap-servers=localhost:19092",
                        "openframe.events.processing.kafka.consumer.max-poll-records=5",
                        "spring.kafka.bootstrap-servers=127.0.0.1:29092", "spring.kafka.consumer.max-poll-records=500")
                .run(context -> {
                    assertThat(projectionConsumerOf(context)).containsEntry("max.poll.records", 5)
                            .containsEntry("auto.offset.reset", "earliest")
                            .containsEntry("bootstrap.servers", List.of("localhost:19092"));
                    ConsumerFactory<?, ?> servicesConsumer = context.getBean("kafkaConsumerFactory", ConsumerFactory.class);
                    assertThat(servicesConsumer.getConfigurationProperties()).containsEntry("max.poll.records", 500);
                });
    }

    @Test
    void theListenerOfASpecsType_readsItsTopic_inTheServicesOwnGroup() {
        runner.run(context -> {
            ContainerProperties listener = organizationListenerOf(context);
            assertThat(listener.getTopics()).containsExactly("events." + ORGANIZATIONS);
            assertThat(listener.getGroupId()).isEqualTo("openframe-saas-stream.processing-" + ORGANIZATIONS);
        });
    }

    @Test
    void theListenerOfASpecsType_takesTheConfiguredPrefixes_asTheDevSharedsDo() {
        runner.withPropertyValues("openframe.events.processing.kafka.topic-prefix=dev3.events.",
                        "openframe.events.processing.kafka.group-prefix=dev3.openframe-saas-stream.processing-")
                .run(context -> {
                    ContainerProperties listener = organizationListenerOf(context);
                    assertThat(listener.getTopics()).containsExactly("dev3.events.organizations");
                    assertThat(listener.getGroupId()).isEqualTo("dev3.openframe-saas-stream.processing-organizations");
                });
    }

    @Test
    void aMissingGroupPrefix_stopsTheServiceFromStarting_soTwoServicesNeverShareAGroup() {
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(PropertyPlaceholderAutoConfiguration.class, KafkaAutoConfiguration.class,
                        EventProcessingAutoConfiguration.class, EventProcessingKafkaAutoConfiguration.class))
                .withUserConfiguration(AggregateSpecRegistry.class)
                .withBean(WidgetSpec.class, EventProcessingKafkaAutoConfigurationTest::widgetSpec)
                .withPropertyValues("openframe.events.enabled=true",
                        "openframe.events.processing.kafka.bootstrap-servers=localhost:9092",
                        "openframe.events.processing.kafka.topic-prefix=events.")
                .withBean(MeterRegistry.class, SimpleMeterRegistry::new)
                .withBean(MongoOperations.class, () -> mock(MongoOperations.class))
                .run(context -> assertThat(context).hasFailed()
                        .getFailure().hasStackTraceContaining("openframe.events.processing.kafka.group-prefix is required"));
    }

    @Test
    void springBootsOwnKafkaTemplate_isStillCreated_nextToTheDltTemplate() {
        runner.run(context -> {
            assertThat(context).hasBean("kafkaTemplate").hasBean("eventProcessingKafkaTemplate");
            KafkaTemplate<?, ?> servicesTemplate = context.getBean(KafkaTemplate.class);
            assertThat(servicesTemplate).isSameAs(context.getBean("kafkaTemplate"));
        });
    }

    @Test
    void theListenerKeys_areApplied_toTheProjectionContainers() {
        runner.withPropertyValues("openframe.events.processing.kafka.listener.concurrency=3",
                        "openframe.events.processing.kafka.listener.ack-mode=record")
                .run(context -> {
                    ConcurrentKafkaListenerContainerFactory<String, byte[]> factory = factoryOf(context);
                    ConcurrentMessageListenerContainer<String, byte[]> container = factory.createContainer("events.organizations");
                    assertThat(container.getConcurrency()).isEqualTo(3);
                    assertThat(container.getContainerProperties().getAckMode()).isEqualTo(ContainerProperties.AckMode.RECORD);
                });
    }

    @Test
    void aMissingBootstrapServers_stopsTheServiceFromStarting_insteadOfUsingLocalhost() {
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(PropertyPlaceholderAutoConfiguration.class, KafkaAutoConfiguration.class,
                        EventProcessingAutoConfiguration.class, EventProcessingKafkaAutoConfiguration.class))
                .withUserConfiguration(AggregateSpecRegistry.class)
                .withBean(WidgetSpec.class, EventProcessingKafkaAutoConfigurationTest::widgetSpec)
                .withPropertyValues("openframe.events.enabled=true",
                        "openframe.events.processing.kafka.topic-prefix=events.",
                        "openframe.events.processing.kafka.group-prefix=openframe-saas-stream.processing-")
                .withBean(MeterRegistry.class, SimpleMeterRegistry::new)
                .withBean(MongoOperations.class, () -> mock(MongoOperations.class))
                .run(context -> assertThat(context).hasFailed()
                        .getFailure().rootCause().hasMessageContaining("bootstrap-servers is required"));
    }

    @Test
    void aMissingTopic_stopsTheProjectionContainers_byDefault() {
        runner.run(context -> assertThat(organizationListenerOf(context).isMissingTopicsFatal()).isTrue());
    }

    @Test
    void theListeners_run_evenWithoutSpringBootsKafkaAutoConfiguration() {
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(PropertyPlaceholderAutoConfiguration.class,
                        EventProcessingAutoConfiguration.class, EventProcessingKafkaAutoConfiguration.class))
                .withUserConfiguration(AggregateSpecRegistry.class)
                .withBean(WidgetSpec.class, EventProcessingKafkaAutoConfigurationTest::widgetSpec)
                .withPropertyValues("openframe.events.enabled=true",
                        "openframe.events.processing.kafka.bootstrap-servers=localhost:9092",
                    "openframe.events.processing.kafka.topic-prefix=events.",
                        "openframe.events.processing.kafka.group-prefix=openframe-saas-stream.processing-",
                        "openframe.events.processing.kafka.listener.auto-startup=false")
                .withBean(MeterRegistry.class, SimpleMeterRegistry::new)
                .withBean(MongoOperations.class, () -> mock(MongoOperations.class))
                .run(context -> assertThat(organizationListenerOf(context).getTopics()).containsExactly("events.organizations"));
    }

    @Test
    void onlyMongoDown_isRetried_andTheWrapperIsNeverRetried_whateverItsCause() {
        runner.run(context -> {
            DefaultErrorHandler errorHandler = errorHandlerOf(context);

            // removeClassification returns how a type was classified: true retried, false not, null the default (not retried).
            assertThat(errorHandler.removeClassification(MongoUnavailableException.class)).isTrue();
            assertThat(errorHandler.removeClassification(EventProcessingFailedException.class)).isFalse();
            assertThat(errorHandler.removeClassification(OptimisticLockingFailureException.class)).isNull();
        });
    }

    private static WidgetSpec widgetSpec() {
        RecordingProjection projection = new RecordingProjection("widget-on-organizations");
        return new WidgetSpec(List.of(projection));
    }

    private static ContainerProperties organizationListenerOf(AssertableApplicationContext context) {
        KafkaListenerEndpointRegistry registry = context.getBean(KafkaListenerEndpointRegistry.class);
        Collection<MessageListenerContainer> containers = registry.getListenerContainers();
        assertThat(containers).hasSize(1);
        MessageListenerContainer container = containers.iterator().next();
        return container.getContainerProperties();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> projectionConsumerOf(AssertableApplicationContext context) {
        return factoryOf(context).getConsumerFactory().getConfigurationProperties();
    }

    private static DefaultErrorHandler errorHandlerOf(AssertableApplicationContext context) {
        ConcurrentMessageListenerContainer<String, byte[]> container = factoryOf(context).createContainer("events.organizations");
        return (DefaultErrorHandler) container.getCommonErrorHandler();
    }

    @SuppressWarnings("unchecked")
    private static ConcurrentKafkaListenerContainerFactory<String, byte[]> factoryOf(AssertableApplicationContext context) {
        return context.getBean(EventProcessingKafkaAutoConfiguration.PROCESSING_CONTAINER_FACTORY,
                ConcurrentKafkaListenerContainerFactory.class);
    }
}
