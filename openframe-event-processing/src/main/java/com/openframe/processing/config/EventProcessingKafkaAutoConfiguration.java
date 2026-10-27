package com.openframe.processing.config;

import com.openframe.processing.config.properties.EventProcessingKafkaProperties;
import com.openframe.processing.exception.EventProcessingFailedException;
import com.openframe.processing.exception.MongoUnavailableException;
import com.openframe.processing.exception.ProjectionConflictException;
import com.openframe.processing.listener.PublishedEventListeners;
import com.openframe.processing.runner.ProjectionRunner;
import com.openframe.processing.topic.EventTopicNames;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.serialization.ByteArrayDeserializer;
import org.apache.kafka.common.serialization.ByteArraySerializer;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.context.properties.PropertyMapper;
import org.springframework.boot.kafka.autoconfigure.KafkaProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.ConsumerAwareRecordRecoverer;
import org.springframework.kafka.listener.ContainerProperties;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.kafka.support.JacksonMapperUtils;
import org.springframework.util.backoff.ExponentialBackOff;
import tools.jackson.databind.cfg.EnumFeature;
import tools.jackson.databind.json.JsonMapper;

import java.time.Duration;
import java.util.List;
import java.util.Map;

// The projection listeners' own consumer, producer and error handling, from openframe.events.processing.kafka.
// @EnableKafka here too: the listeners must not depend on Spring Boot's Kafka auto-configuration being present.
@Slf4j
@EnableKafka
@AutoConfiguration(after = EventProcessingAutoConfiguration.class)
@ConditionalOnBean(ProjectionRunner.class)
public class EventProcessingKafkaAutoConfiguration {

    public static final String PROCESSING_CONTAINER_FACTORY = "eventProcessingKafkaListenerContainerFactory";

    private static final int ANY_PARTITION = -1;

    // Not a default candidate, here and on the template: Spring Boot still creates its own, and the context closes this one.
    @Bean(defaultCandidate = false)
    public DefaultKafkaProducerFactory<String, byte[]> eventProcessingKafkaProducerFactory(
            EventProcessingKafkaProperties processingKafkaProperties) {
        EventProcessingKafkaProperties.Kafka kafka = processingKafkaProperties.getKafka();
        requireBootstrapServers(kafka);
        Map<String, Object> producerProperties = kafka.buildProducerProperties();
        producerProperties.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        producerProperties.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, ByteArraySerializer.class);
        return new DefaultKafkaProducerFactory<>(producerProperties);
    }

    // Sends a failed record to its DLT as received: key and value bytes unchanged.
    @Bean(defaultCandidate = false)
    public KafkaTemplate<String, byte[]> eventProcessingKafkaTemplate(
        @Qualifier("eventProcessingKafkaProducerFactory") DefaultKafkaProducerFactory<String, byte[]> producerFactory) {
        return new KafkaTemplate<>(producerFactory);
    }

    @Bean(PROCESSING_CONTAINER_FACTORY)
    public ConcurrentKafkaListenerContainerFactory<String, byte[]> eventProcessingKafkaListenerContainerFactory(
        EventProcessingKafkaProperties processingKafkaProperties,
        @Qualifier("eventProcessingKafkaTemplate") KafkaTemplate<String, byte[]> eventProcessingKafkaTemplate) {
        EventProcessingKafkaProperties.Kafka kafka = processingKafkaProperties.getKafka();
        requireBootstrapServers(kafka);
        Map<String, Object> consumerProperties = kafka.buildConsumerProperties();

        consumerProperties.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        consumerProperties.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, ByteArrayDeserializer.class);
        DefaultKafkaConsumerFactory<String, byte[]> consumerFactory = new DefaultKafkaConsumerFactory<>(consumerProperties);

        EventProcessingKafkaProperties.BackOff backOff = kafka.getBackOff();
        DefaultErrorHandler errorHandler = buildErrorHandler(backOff, eventProcessingKafkaTemplate);

        ConcurrentKafkaListenerContainerFactory<String, byte[]> factory = new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(consumerFactory);
        factory.setCommonErrorHandler(errorHandler);
        KafkaProperties.Listener listener = kafka.getListener();
        applyListenerProperties(listener, factory);
        return factory;
    }

    @Bean
    public PublishedEventListeners publishedEventListeners(AggregateSpecRegistry specRegistry,
                                                           ProjectionRunner projectionRunner,
                                                           EventProcessingKafkaProperties processingKafkaProperties,
                                                           @Qualifier(PROCESSING_CONTAINER_FACTORY) ConcurrentKafkaListenerContainerFactory<String, byte[]> containerFactory) {
        JsonMapper envelopeMapper = buildEnvelopeMapper();
        return new PublishedEventListeners(specRegistry, projectionRunner, processingKafkaProperties, envelopeMapper,
            containerFactory);
    }

    // Spring Kafka's mapper (unknown fields ignored); an enum value from a newer producer becomes null, not a DLT record.
    public static JsonMapper buildEnvelopeMapper() {
        JsonMapper springKafkaMapper = JacksonMapperUtils.enhancedJsonMapper();
        return springKafkaMapper.rebuild()
            .enable(EnumFeature.READ_UNKNOWN_ENUM_VALUES_AS_NULL)
            .build();
    }

    // Spring Boot's own mapping of spring.kafka.listener, which our hand-built factory would otherwise ignore.
    private void applyListenerProperties(KafkaProperties.Listener listener,
                                         ConcurrentKafkaListenerContainerFactory<String, byte[]> factory) {
        PropertyMapper map = PropertyMapper.get();
        map.from(listener::getConcurrency).to(factory::setConcurrency);
        map.from(listener::isAutoStartup).to(factory::setAutoStartup);
        map.from(listener::getChangeConsumerThreadName).to(factory::setChangeConsumerThreadName);
        ContainerProperties container = factory.getContainerProperties();
        map.from(listener::getAckMode).to(container::setAckMode);
        map.from(listener::getAsyncAcks).to(container::setAsyncAcks);
        map.from(listener::getClientId).to(container::setClientId);
        map.from(listener::getAckCount).to(container::setAckCount);
        map.from(listener::getAckTime).as(Duration::toMillis).to(container::setAckTime);
        map.from(listener::getPollTimeout).as(Duration::toMillis).to(container::setPollTimeout);
        map.from(listener::getNoPollThreshold).to(container::setNoPollThreshold);
        map.from(listener::getIdleBetweenPolls).as(Duration::toMillis).to(container::setIdleBetweenPolls);
        map.from(listener::getIdleEventInterval).as(Duration::toMillis).to(container::setIdleEventInterval);
        map.from(listener::getIdlePartitionEventInterval).as(Duration::toMillis).to(container::setIdlePartitionEventInterval);
        map.from(listener::getLogContainerConfig).to(container::setLogContainerConfig);
        map.from(listener::isMissingTopicsFatal).to(container::setMissingTopicsFatal);
        map.from(listener::isImmediateStop).to(container::setStopImmediate);
        map.from(listener::getAuthExceptionRetryInterval).to(container::setAuthExceptionRetryInterval);
    }

    // Only Mongo down and a conflict with another consumer are retried, without limit; the wrapper is never retried.
    private DefaultErrorHandler buildErrorHandler(EventProcessingKafkaProperties.BackOff backOff,
                                                  KafkaTemplate<String, byte[]> eventProcessingKafkaTemplate) {
        ConsumerAwareRecordRecoverer deadLetters = buildDeadLetterRecoverer(eventProcessingKafkaTemplate);
        ExponentialBackOff retryBackOff = buildExponentialBackOff(backOff);
        DefaultErrorHandler errorHandler = new DefaultErrorHandler(deadLetters, retryBackOff);
        errorHandler.defaultFalse();
        errorHandler.addRetryableExceptions(MongoUnavailableException.class, ProjectionConflictException.class);
        errorHandler.addNotRetryableExceptions(EventProcessingFailedException.class);
        return errorHandler;
    }

    private ConsumerAwareRecordRecoverer buildDeadLetterRecoverer(KafkaTemplate<String, byte[]> eventProcessingKafkaTemplate) {
        // The DLT has one partition whatever the topic has, so Kafka picks it.
        DeadLetterPublishingRecoverer deadLetters = new DeadLetterPublishingRecoverer(eventProcessingKafkaTemplate,
                (record, failure) -> {
                    String deadLetterTopic = deadLetterTopicOf(record);
                    return new TopicPartition(deadLetterTopic, ANY_PARTITION);
                });
        // Spring logs a sent record only at DEBUG; this logs every one, also an unreadable value that reached no processor.
        return (record, consumer, failure) -> {
            String deadLetterTopic = deadLetterTopicOf(record);
            log.error("Record {} of {}-{} at offset {} goes to {}", record.key(), record.topic(), record.partition(),
                    record.offset(), deadLetterTopic, failure);
            deadLetters.accept(record, consumer, failure);
        };
    }

    private static String deadLetterTopicOf(ConsumerRecord<?, ?> record) {
        String topic = record.topic();
        return EventTopicNames.deadLetterTopicOf(topic);
    }

    private ExponentialBackOff buildExponentialBackOff(EventProcessingKafkaProperties.BackOff backOff) {
        long initialInterval = backOff.getInitialInterval().toMillis();
        long maxInterval = backOff.getMaxInterval().toMillis();
        double multiplier = backOff.getMultiplier();
        ExponentialBackOff exponentialBackOff = new ExponentialBackOff(initialInterval, multiplier);
        exponentialBackOff.setMaxInterval(maxInterval);
        return exponentialBackOff;
    }

    private static void requireBootstrapServers(EventProcessingKafkaProperties.Kafka kafka) {
        List<String> bootstrapServers = kafka.getBootstrapServers();
        if (bootstrapServers.isEmpty()) {
            throw new IllegalStateException(
                    "openframe.events.processing.kafka.bootstrap-servers is required when event processing is on");
        }
    }
}
