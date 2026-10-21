package com.openframe.processing.config;

import com.openframe.data.repository.organization.publishing.OrganizationEvent;
import com.openframe.processing.listener.OrganizationEventListener;
import com.openframe.processing.runner.EventProcessingFailedException;
import com.openframe.processing.runner.MongoUnavailableException;
import com.openframe.publishing.api.PublishedAggregateType;
import com.openframe.publishing.api.PublishedRecord;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.common.serialization.ByteArrayDeserializer;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.context.PropertyPlaceholderAutoConfiguration;
import org.springframework.boot.kafka.autoconfigure.KafkaAutoConfiguration;
import org.springframework.boot.test.context.assertj.AssertableApplicationContext;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.config.KafkaListenerEndpointRegistry;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.ConcurrentMessageListenerContainer;
import org.springframework.kafka.listener.ContainerProperties;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.kafka.listener.MessageListenerContainer;
import org.springframework.kafka.support.KafkaNull;
import org.springframework.kafka.support.converter.ByteArrayJacksonJsonMessageConverter;
import org.springframework.messaging.Message;

import java.lang.reflect.Method;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.util.Collection;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class EventProcessingKafkaAutoConfigurationTest {

    private static final PublishedAggregateType ORGANIZATIONS = PublishedAggregateType.ORGANIZATIONS;

    private static final String ENVELOPE = """
            {"tenantId":"tenant-1","version":3,"deleted":false,"schemaVersion":1,
             "event":{"organizationId":"org-1","name":"Acme","fieldFromANewerProducer":true}}
            """;

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(PropertyPlaceholderAutoConfiguration.class, KafkaAutoConfiguration.class,
                    EventProcessingAutoConfiguration.class, EventProcessingKafkaAutoConfiguration.class))
            .withPropertyValues("openframe.events.processing.enabled=true",
                    "openframe.events.processing.kafka.bootstrap-servers=localhost:9092",
                    "openframe.events.processing.kafka.topic-prefix=events.",
                    "openframe.events.processing.kafka.group-prefix=openframe-saas-stream.processing-",
                    "openframe.events.processing.kafka.listener.auto-startup=false")
            .withBean(MeterRegistry.class, SimpleMeterRegistry::new);

    @Test
    void theProcessorConsumer_readsFromEarliest_inSmallPolls_byDefault() {
        runner.run(context -> {
            Map<String, Object> consumer = processorConsumerOf(context);
            assertThat(consumer).containsEntry("auto.offset.reset", "earliest").containsEntry("max.poll.records", 20);
            assertThat(consumer.get("value.deserializer")).isEqualTo(ByteArrayDeserializer.class);
        });
    }

    @Test
    void theProcessorConsumer_takesItsOwnClusterAndSettings_notTheServicesSpringKafka() {
        runner.withPropertyValues("openframe.events.processing.kafka.bootstrap-servers=localhost:19092",
                        "openframe.events.processing.kafka.consumer.max-poll-records=5",
                        "spring.kafka.bootstrap-servers=127.0.0.1:29092", "spring.kafka.consumer.max-poll-records=500")
                .run(context -> {
                    assertThat(processorConsumerOf(context)).containsEntry("max.poll.records", 5)
                            .containsEntry("auto.offset.reset", "earliest")
                            .containsEntry("bootstrap.servers", List.of("localhost:19092"));
                    ConsumerFactory<?, ?> servicesConsumer = context.getBean("kafkaConsumerFactory", ConsumerFactory.class);
                    assertThat(servicesConsumer.getConfigurationProperties()).containsEntry("max.poll.records", 500);
                });
    }

    @Test
    void theOrganizationListener_readsTheConfiguredTopic_inTheServicesOwnGroup() {
        runner.run(context -> {
            ContainerProperties listener = organizationListenerOf(context);
            assertThat(listener.getTopics()).containsExactly("events." + ORGANIZATIONS.getName());
            assertThat(listener.getGroupId()).isEqualTo("openframe-saas-stream.processing-" + ORGANIZATIONS.getName());
        });
    }

    @Test
    void theOrganizationListener_takesTheConfiguredPrefixes_asTheDevSharedsDo() {
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
                .withPropertyValues("openframe.events.processing.enabled=true",
                        "openframe.events.processing.kafka.bootstrap-servers=localhost:9092",
                        "openframe.events.processing.kafka.topic-prefix=events.")
                .withBean(MeterRegistry.class, SimpleMeterRegistry::new)
                .run(context -> assertThat(context).hasFailed()
                        .getFailure().rootCause().hasMessageContaining("openframe.events.processing.kafka.group-prefix"));
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
    void theListenerKeys_areApplied_toTheProcessorContainers() {
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
                .withPropertyValues("openframe.events.processing.enabled=true",
                        "openframe.events.processing.kafka.topic-prefix=events.",
                        "openframe.events.processing.kafka.group-prefix=openframe-saas-stream.processing-")
                .withBean(MeterRegistry.class, SimpleMeterRegistry::new)
                .run(context -> assertThat(context).hasFailed()
                        .getFailure().rootCause().hasMessageContaining("bootstrap-servers is required"));
    }

    @Test
    void aMissingTopic_stopsTheProcessorContainers_byDefault() {
        runner.run(context -> assertThat(organizationListenerOf(context).isMissingTopicsFatal()).isTrue());
    }

    @Test
    void theListeners_run_evenWithoutSpringBootsKafkaAutoConfiguration() {
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(PropertyPlaceholderAutoConfiguration.class,
                        EventProcessingAutoConfiguration.class, EventProcessingKafkaAutoConfiguration.class))
                .withPropertyValues("openframe.events.processing.enabled=true",
                        "openframe.events.processing.kafka.bootstrap-servers=localhost:9092",
                    "openframe.events.processing.kafka.topic-prefix=events.",
                        "openframe.events.processing.kafka.group-prefix=openframe-saas-stream.processing-",
                        "openframe.events.processing.kafka.listener.auto-startup=false")
                .withBean(MeterRegistry.class, SimpleMeterRegistry::new)
                .run(context -> assertThat(organizationListenerOf(context).getTopics()).containsExactly("events.organizations"));
    }

    @Test
    void anEnumValueFromANewerProducer_isReadAsNull() throws NoSuchMethodException {
        ByteArrayJacksonJsonMessageConverter converter = EventProcessingKafkaAutoConfiguration.buildEnvelopeConverter();
        Method onOrganization = OrganizationEventListener.class.getMethod("onOrganization", String.class, PublishedRecord.class);
        Type parameterType = onOrganization.getGenericParameterTypes()[1];
        String envelope = """
                {"tenantId":"tenant-1","version":3,"deleted":false,"schemaVersion":1,
                 "event":{"organizationId":"org-1","name":"Acme","status":"STATUS_FROM_A_NEWER_PRODUCER"}}
                """;
        byte[] value = envelope.getBytes(StandardCharsets.UTF_8);
        ConsumerRecord<String, byte[]> record = new ConsumerRecord<>("events.organizations", 0, 7L, "organization-document-1", value);

        Message<?> message = converter.toMessage(record, null, null, parameterType);

        assertThat(message.getPayload()).isInstanceOfSatisfying(PublishedRecord.class, published ->
                assertThat(published.getEvent()).isInstanceOfSatisfying(OrganizationEvent.class, event ->
                        assertThat(event.getStatus()).isNull()));
    }

    @Test
    void theEnvelope_isReadIntoTheListenersParameterType_ignoringFieldsTheConsumerDoesNotKnow() throws NoSuchMethodException {
        ByteArrayJacksonJsonMessageConverter converter = EventProcessingKafkaAutoConfiguration.buildEnvelopeConverter();
        Method onOrganization = OrganizationEventListener.class.getMethod("onOrganization", String.class, PublishedRecord.class);
        Type parameterType = onOrganization.getGenericParameterTypes()[1];
        byte[] value = ENVELOPE.getBytes(StandardCharsets.UTF_8);
        ConsumerRecord<String, byte[]> record = new ConsumerRecord<>("events.organizations", 0, 5L, "org-1", value);

        Message<?> message = converter.toMessage(record, null, null, parameterType);

        assertThat(message.getPayload()).isInstanceOfSatisfying(PublishedRecord.class, envelope -> {
            assertThat(envelope.getTenantId()).isEqualTo("tenant-1");
            assertThat(envelope.getVersion()).isEqualTo(3L);
            assertThat(envelope.getEvent()).isInstanceOfSatisfying(OrganizationEvent.class, event ->
                    assertThat(event.getName()).isEqualTo("Acme"));
        });
    }

    @Test
    void aTombstone_reachesTheListenerAsNoPayload() throws NoSuchMethodException {
        ByteArrayJacksonJsonMessageConverter converter = EventProcessingKafkaAutoConfiguration.buildEnvelopeConverter();
        Method onOrganization = OrganizationEventListener.class.getMethod("onOrganization", String.class, PublishedRecord.class);
        Type parameterType = onOrganization.getGenericParameterTypes()[1];
        ConsumerRecord<String, byte[]> tombstone = new ConsumerRecord<>("events.organizations", 0, 6L, "org-1", null);

        Message<?> message = converter.toMessage(tombstone, null, null, parameterType);

        assertThat(message.getPayload()).isEqualTo(KafkaNull.INSTANCE);
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

    private static ContainerProperties organizationListenerOf(AssertableApplicationContext context) {
        KafkaListenerEndpointRegistry registry = context.getBean(KafkaListenerEndpointRegistry.class);
        Collection<MessageListenerContainer> containers = registry.getListenerContainers();
        assertThat(containers).hasSize(1);
        MessageListenerContainer container = containers.iterator().next();
        return container.getContainerProperties();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> processorConsumerOf(AssertableApplicationContext context) {
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
