package com.openframe.kafka.listener;

import com.openframe.kafka.config.KafkaJsonSerdes;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.serialization.Deserializer;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.core.KafkaOperations;
import org.springframework.kafka.listener.ConsumerRecordRecoverer;
import org.springframework.kafka.listener.ContainerProperties;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.kafka.support.serializer.ErrorHandlingDeserializer;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

// A listener container factory with retries and a dead-letter topic, on top of any consumer factory: values go
// through an ErrorHandlingDeserializer, so an unparsable record reaches the error handler instead of looping; each
// failure is retried as the policy says, then the record goes unchanged to `<topic>-dlt` (raw bytes through the
// bytes template, objects through the object template). Acks per record.
@Slf4j
public final class RetryingListenerContainerFactories {

    private RetryingListenerContainerFactories() {
    }

    public static ConcurrentKafkaListenerContainerFactory<Object, Object> create(
            ConsumerFactory<?, ?> base, KafkaOperations<String, byte[]> deadLetterBytes,
            KafkaOperations<?, ?> deadLetterObjects, ConsumerRetryPolicy policy) {
        Map<String, Object> config = new HashMap<>(base.getConfigurationProperties());
        DefaultKafkaConsumerFactory<Object, Object> consumers = new DefaultKafkaConsumerFactory<>(config,
                RetryingListenerContainerFactories::stringKeys,
                () -> new ErrorHandlingDeserializer<>(KafkaJsonSerdes.valueDeserializer()));
        ConsumerRecordRecoverer recoverer = deadLetterRecoverer(deadLetterBytes, deadLetterObjects);
        DefaultErrorHandler errorHandler = new DefaultErrorHandler(recoverer);
        errorHandler.setBackOffFunction(policy::backOffFor);
        ConcurrentKafkaListenerContainerFactory<Object, Object> factory =
                new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(consumers);
        factory.getContainerProperties().setAckMode(ContainerProperties.AckMode.RECORD);
        factory.setCommonErrorHandler(errorHandler);
        return factory;
    }

    private static ConsumerRecordRecoverer deadLetterRecoverer(KafkaOperations<String, byte[]> deadLetterBytes,
                                                               KafkaOperations<?, ?> deadLetterObjects) {
        Map<Class<?>, KafkaOperations<?, ?>> templates = new LinkedHashMap<>();
        templates.put(byte[].class, deadLetterBytes);
        templates.put(Object.class, deadLetterObjects);
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(templates,
                RetryingListenerContainerFactories::deadLetterPartition);
        return (record, failure) -> publishAndLog(recoverer, record, failure);
    }

    private static TopicPartition deadLetterPartition(ConsumerRecord<?, ?> record, Exception failure) {
        String deadLetterTopic = DeadLetterTopics.of(record.topic());
        return new TopicPartition(deadLetterTopic, -1);
    }

    // Logged once the publish is confirmed (the recoverer throws when it fails); the value is never logged, it can
    // carry customer content.
    private static void publishAndLog(DeadLetterPublishingRecoverer recoverer, ConsumerRecord<?, ?> record,
                                      Exception failure) {
        recoverer.accept(record, failure);
        log.error("Record {} of {}-{} at offset {} went to {}", record.key(), record.topic(), record.partition(),
                record.offset(), DeadLetterTopics.of(record.topic()));
    }

    // Keys are strings on every topic; the factory is typed <Object, Object> like the listener containers it feeds.
    @SuppressWarnings({"unchecked", "rawtypes"})
    private static Deserializer<Object> stringKeys() {
        return (Deserializer) new StringDeserializer();
    }
}
