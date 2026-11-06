package com.openframe.kafka.producer.retry;

import com.openframe.kafka.model.KafkaMessage;
import com.openframe.kafka.producer.MessageProducer;

import java.util.Map;

// No @Retryable: the Kafka client already retries for delivery.timeout.ms, and a retry on top waits that long again and can duplicate the record.
public abstract class BaseRetryingKafkaProducer {

    protected final MessageProducer producer;
    protected final KafkaRecoveryHandler recoveryHandler;

    public BaseRetryingKafkaProducer(MessageProducer producer, KafkaRecoveryHandler recoveryHandler) {
        this.producer = producer;
        this.recoveryHandler = recoveryHandler;
    }

    public void publish(String topic, String key, KafkaMessage payload) {
        producer.sendAndAwaitMessage(topic, payload, key);
    }

    public void publish(String topic, String key, KafkaMessage payload, Map<String, Object> headers) {
        producer.sendAndAwaitMessage(topic, payload, key, headers);
    }
}
