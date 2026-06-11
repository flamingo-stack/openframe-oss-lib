package com.openframe.kafka.producer;

import com.openframe.kafka.exception.NonRetryableKafkaException;
import com.openframe.kafka.exception.TransientKafkaSendException;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.common.errors.AuthorizationException;
import org.apache.kafka.common.errors.InvalidTopicException;
import org.apache.kafka.common.errors.RecordTooLargeException;
import org.apache.kafka.common.errors.RetriableException;
import org.apache.kafka.common.errors.SerializationException;
import org.apache.kafka.common.errors.TimeoutException;
import org.apache.kafka.common.errors.TopicAuthorizationException;
import org.apache.kafka.common.errors.UnknownTopicOrPartitionException;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.kafka.support.SendResult;
import org.springframework.messaging.Message;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.util.StringUtils;

import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;

@Slf4j
public abstract class GenericKafkaProducer {

    private static final int MAX_PAYLOAD_LOG_LEN = 500;

    private final KafkaTemplate<String, Object> kafkaTemplate;

    protected GenericKafkaProducer(KafkaTemplate<String, Object> kafkaTemplate) {
        this.kafkaTemplate = Objects.requireNonNull(kafkaTemplate, "KafkaTemplate must not be null");
    }

    /**
     * Async send: returns future (fire-and-forget friendly).
     * Note: exceptions are handled by the future itself; this callback only logs.
     */
    public CompletableFuture<SendResult<String, Object>> sendAsync(
            String topic, String key, Object payload
    ) {
        validateTopic(topic);

        var future = (key == null)
                ? kafkaTemplate.send(topic, payload)
                : kafkaTemplate.send(topic, key, payload);

        future.whenComplete((res, ex) -> {
            if (ex != null) {
                // LOG ONLY. Do not throw here – it won't change the future's state.
                handleSendFailure(topic, key, payload, ex);
            } else if (res != null && res.getRecordMetadata() != null) {
                var md = res.getRecordMetadata();
                logSendSuccess(md.topic(), key, md.partition(), md.offset());
            } else {
                log.debug("Kafka PRODUCE success: topic={}, key={} (no record metadata)", topic, redact(key));
            }
        });

        return future;
    }

    /**
     * Sync send: blocking variant for controlled retries (Spring Retry) and SLA.
     * Classifies fatal vs transient and throws dedicated runtime exceptions that carry the original cause.
     */
    public void sendAndAwait(String topic, String key, Object payload) {
        try {
            sendAsync(topic, key, payload).join(); // throws CompletionException on failure
        } catch (CompletionException ce) {
            throw classifyCompletion(ce, topic, key);
        }
    }

    /**
     * Async send with extra Kafka record headers (e.g. {@code message-type}).
     * {@code __TypeId__} is still added by the JsonSerializer from the payload's
     * runtime class — control it by choosing the payload type.
     */
    public CompletableFuture<SendResult<String, Object>> sendAsync(
            String topic, String key, Object payload, Map<String, Object> headers
    ) {
        validateTopic(topic);

        MessageBuilder<Object> builder = MessageBuilder.withPayload(payload)
                .setHeader(KafkaHeaders.TOPIC, topic);
        if (key != null) {
            builder.setHeader(KafkaHeaders.KEY, key);
        }
        if (headers != null) {
            headers.forEach(builder::setHeader);
        }
        Message<Object> message = builder.build();

        var future = kafkaTemplate.send(message);
        future.whenComplete((res, ex) -> {
            if (ex != null) {
                handleSendFailure(topic, key, payload, ex);
            } else if (res != null && res.getRecordMetadata() != null) {
                var md = res.getRecordMetadata();
                logSendSuccess(md.topic(), key, md.partition(), md.offset());
            } else {
                log.debug("Kafka PRODUCE success: topic={}, key={} (no record metadata)", topic, redact(key));
            }
        });
        return future;
    }

    /**
     * Sync send with extra Kafka record headers. Same fatal/transient classification
     * as {@link #sendAndAwait(String, String, Object)}.
     */
    public void sendAndAwait(String topic, String key, Object payload, Map<String, Object> headers) {
        try {
            sendAsync(topic, key, payload, headers).join();
        } catch (CompletionException ce) {
            throw classifyCompletion(ce, topic, key);
        }
    }

    private RuntimeException classifyCompletion(CompletionException ce, String topic, String key) {
        Throwable cause = ce.getCause();

        // Non-retryable (fail fast)
        if (cause instanceof RecordTooLargeException
                || cause instanceof AuthorizationException
                || cause instanceof SerializationException
                || cause instanceof InvalidTopicException) {
            return new NonRetryableKafkaException(
                    "fatal kafka error: topic=%s key=%s".formatted(topic, key), cause);
        }

        // UnknownTopicOrPartitionException is retryable — topic may be in the process
        // of being auto-created by the broker and will become available shortly.
        if (cause instanceof UnknownTopicOrPartitionException) {
            log.warn("Kafka topic not yet available (may be auto-creating): topic={}, key={}", topic, key);
            return new TransientKafkaSendException(
                    "topic not yet available: topic=%s key=%s".formatted(topic, key), cause);
        }

        // Retryable (transient)
        return new TransientKafkaSendException(
                "transient kafka error: topic=%s key=%s".formatted(topic, key), cause);
    }

    private void validateTopic(String topic) {
        if (!StringUtils.hasText(topic)) {
            throw new NonRetryableKafkaException("Topic is null or blank", null);
        }
    }

    /**
     * Async callback logging (do not throw here).
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

            case TimeoutException te ->
                    log.error("Kafka PRODUCE timeout: topic={}, key={}, payload~={}",
                            topic, redact(key), shortPayload, te);

            case RetriableException re ->
                    log.warn("Kafka PRODUCE retriable failure: topic={}, key={}, payload~={}",
                            topic, redact(key), shortPayload, re);

            default ->
                    log.error("Kafka PRODUCE failure: topic={}, key={}, payload~={}",
                            topic, redact(key), shortPayload, ex);
        }
    }

    private void logSendSuccess(String topic, String key, int partition, long offset) {
        log.debug("Kafka PRODUCE success: topic={}, key={}, partition={}, offset={}",
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
