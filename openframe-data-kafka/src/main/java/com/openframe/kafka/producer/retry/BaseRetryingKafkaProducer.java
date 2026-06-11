package com.openframe.kafka.producer.retry;

import com.openframe.kafka.exception.NonRetryableKafkaException;
import com.openframe.kafka.exception.TransientKafkaSendException;
import com.openframe.kafka.model.KafkaMessage;
import com.openframe.kafka.producer.MessageProducer;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Recover;
import org.springframework.retry.annotation.Retryable;

import java.util.Map;

public abstract class BaseRetryingKafkaProducer {

    protected final MessageProducer producer;
    protected final KafkaRecoveryHandler recoveryHandler;

    public BaseRetryingKafkaProducer(MessageProducer producer, KafkaRecoveryHandler recoveryHandler) {
        this.producer = producer;
        this.recoveryHandler = recoveryHandler;
    }

    @Retryable(
            retryFor = { TransientKafkaSendException.class },
            noRetryFor = { NonRetryableKafkaException.class },
            maxAttempts = 5,
            backoff = @Backoff(delay = 500, multiplier = 2.0, maxDelay = 5000)
    )
    public void publish(String topic, String key, KafkaMessage payload) {
        producer.sendAndAwaitMessage(topic, payload, key);
    }

    @Retryable(
            retryFor = { TransientKafkaSendException.class },
            noRetryFor = { NonRetryableKafkaException.class },
            maxAttempts = 5,
            backoff = @Backoff(delay = 500, multiplier = 2.0, maxDelay = 5000)
    )
    public void publish(String topic, String key, KafkaMessage payload, Map<String, Object> headers) {
        producer.sendAndAwaitMessage(topic, payload, key, headers);
    }

    /** Recover for non-retryable failures (fail fast → DLQ etc.) */
    @Recover
    public void recover(NonRetryableKafkaException ex, String topic, String key, KafkaMessage payload) {
        recoveryHandler.enqueue(ex, topic, key, payload);
    }

    /** Recover for transient failures after all attempts exhausted (→ outbox, notify, etc.) */
    @Recover
    public void recover(TransientKafkaSendException ex, String topic, String key, KafkaMessage payload) {
        recoveryHandler.enqueue(ex, topic, key, payload);
    }

    @Recover
    public void recover(NonRetryableKafkaException ex, String topic, String key, KafkaMessage payload, Map<String, Object> headers) {
        recoveryHandler.enqueue(ex, topic, key, payload, headers);
    }

    @Recover
    public void recover(TransientKafkaSendException ex, String topic, String key, KafkaMessage payload, Map<String, Object> headers) {
        recoveryHandler.enqueue(ex, topic, key, payload, headers);
    }
}
