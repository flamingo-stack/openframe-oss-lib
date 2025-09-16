package com.openframe.kafka.producer;

import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.common.errors.*;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.util.StringUtils;

import java.util.Objects;

@Slf4j
public abstract class GenericKafkaProducer {

    // Avoid logging huge payloads
    private static final int MAX_PAYLOAD_LOG_LEN = 500;

    private final KafkaTemplate<String, Object> kafkaTemplate;

    public GenericKafkaProducer(KafkaTemplate<String, Object> kafkaTemplate) {
        this.kafkaTemplate = Objects.requireNonNull(kafkaTemplate, "KafkaTemplate must not be null");
    }

    /**
     * Send without key. Non-blocking (callbacks attached to the future).
     */
    protected void sendMessage(String topic, Object message) {
        if (!StringUtils.hasText(topic)) {
            throw new MessageDeliveryException("Topic is null or blank");
        }
        sendMessage(topic, null, message);
    }

    /**
     * Send with key. Non-blocking (callbacks attached to the future).
     */
    protected void sendMessage(String topic, String key, Object message) {
        if (!StringUtils.hasText(topic)) {
            throw new MessageDeliveryException("Topic is null or blank");
        }
        try {
            kafkaTemplate.send(topic, key, message)
                    .whenComplete((result, ex) -> {
                        if (ex != null) {
                            handleSendFailure(topic, key, message, ex);
                        } else if (result != null && result.getRecordMetadata() != null) {
                            var md = result.getRecordMetadata();
                            logSendSuccess(md.topic(), key, md.partition(), md.offset());
                        } else {
                            log.info("Kafka PRODUCE success: topic={}, key={} (no record metadata)", topic, redact(key));
                        }
                    });

        } catch (SerializationException e) {
            throw new MessageDeliveryException("Serialization failed for topic: %s, key: %s, cause: %s"
                    .formatted(topic, key, e));
        } catch (IllegalArgumentException e) {
            throw new MessageDeliveryException("Invalid arguments for topic: %s, key: %s, cause: %s"
                    .formatted(topic, key, e));
        }
    }

    /**
     * Handle async send failure with proper logging and types.
     * Uses Java 21 pattern-matching switch for clarity.
     */
    private void handleSendFailure(String topic, String key, Object payload, Throwable ex) {
        String shortPayload = abbreviate(String.valueOf(payload), MAX_PAYLOAD_LOG_LEN);
        String originalPayload = String.valueOf(payload);

        switch (ex) {
            case TopicAuthorizationException tae ->
                    log.error("Kafka PRODUCE authorization error: topic={}, key={}, payload~={}",
                            topic, redact(key), shortPayload, tae);

            case RecordTooLargeException rtle ->
                    log.error("Kafka PRODUCE record too large: topic={}, key={}, payloadSize={}",
                            topic, redact(key), originalPayload.length(), rtle);

            case TimeoutException te -> log.error("Kafka PRODUCE timeout: topic={}, key={}, payload~={}",
                    topic, redact(key), shortPayload, te);

            case RetriableException re ->
                    log.warn("Kafka PRODUCE retriable failure: topic={}, key={}, payload~={}",
                            topic, redact(key), shortPayload, re);

            default -> log.error("Kafka PRODUCE failure: topic={}, key={}, payload~={}",
                    topic, redact(key), shortPayload, ex);
        }
    }

    /**
     * Log async success with minimal useful metadata.
     */
    private void logSendSuccess(String topic, String key, int partition, long offset) {
        log.info("Kafka PRODUCE success: topic={}, key={}, partition={}, offset={}",
                topic, redact(key), partition, offset);
    }

    private static String abbreviate(String s, int max) {
        if (s == null) return "null";
        if (s.length() <= max) return s;
        return s.substring(0, max) + "...(truncated)";
    }

    private static String redact(String s) {
        return (s == null) ? "null" : (s.length() <= 6 ? "***" : s.substring(0, 3) + "…");
    }
}
