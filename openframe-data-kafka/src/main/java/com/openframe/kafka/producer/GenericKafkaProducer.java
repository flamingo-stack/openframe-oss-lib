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

        try {
            kafkaTemplate.send(topic, message)
                    .whenComplete((result, ex) -> {
                        if (ex != null) {
                            handleSendFailure(topic, null, message, ex);
                        } else if (result != null && result.getRecordMetadata() != null) {
                            var md = result.getRecordMetadata();
                            logSendSuccess(md.topic(), null, md.partition(), md.offset());
                        } else {
                            log.info("Kafka PRODUCE success: topic={} (no record metadata)", topic);
                        }
                    });

        } catch (SerializationException e) {
            // Synchronous serialization failure
            throw new MessageDeliveryException("Serialization failed for topic: %s, cause: %s".formatted(topic, e));
        } catch (IllegalArgumentException e) {
            // Invalid arguments (e.g., blank topic)
            throw new MessageDeliveryException("Invalid arguments for topic: %s, cause: %s".formatted(topic, e));
        }
    }

    /**
     * Send with key. Non-blocking (callbacks attached to the future).
     */
    protected void sendMessage(String topic, String key, Object message) {
        if (!StringUtils.hasText(topic)) {
            throw new MessageDeliveryException("Topic is null or blank");
        }
        if (!StringUtils.hasText(key)) {
            sendMessage(topic, message);
        } else {

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
    }

    /**
     * Handle async send failure with proper logging and types.
     * Uses Java 21 pattern-matching switch for clarity.
     */
    private void handleSendFailure(String topic, String key, Object payload, Throwable ex) {
        String shortPayload = abbreviate(String.valueOf(payload), MAX_PAYLOAD_LOG_LEN);

        switch (ex) {
            case TopicAuthorizationException tae ->
                    log.error("Kafka PRODUCE authorization error: topic={}, key={}, payload~={} | {}",
                            topic, redact(key), shortPayload, tae, tae);

            case RecordTooLargeException rtle ->
                    log.error("Kafka PRODUCE record too large: topic={}, key={}, payloadSize={} | {}",
                            topic, redact(key), shortPayload.length(), rtle, rtle);

            case TimeoutException te ->
                    log.error("Kafka PRODUCE timeout: topic={}, key={}, payload~={} | {}",
                            topic, redact(key), shortPayload, te, te);

            case RetriableException re ->
                // Producer will retry per configs; warn is enough for visibility.
                    log.warn("Kafka PRODUCE retriable failure: topic={}, key={}, payload~={} | {}",
                            topic, redact(key), shortPayload, re, re);

            // Default branch for all other Throwables
            default ->
                    log.error("Kafka PRODUCE failure: topic={}, key={}, payload~={} | {}",
                            topic, redact(key), shortPayload, ex, ex);
        }
        // Do not rethrow here — caller is fire-and-forget.
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
