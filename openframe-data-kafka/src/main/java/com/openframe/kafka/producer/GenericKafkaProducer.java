package com.openframe.kafka.producer;

import com.openframe.kafka.exception.NonRetryableKafkaException;
import com.openframe.kafka.exception.TransientKafkaSendException;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.common.errors.*;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.util.StringUtils;

import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.TimeUnit;

@Slf4j
public abstract class GenericKafkaProducer {

    private static final int MAX_PAYLOAD_LOG_LEN = 500;
    private static final long DEFAULT_SYNC_SEND_TIMEOUT_MS = 30_000;

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
                log.info("Kafka PRODUCE success: topic={}, key={} (no record metadata)", topic, redact(key));
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
            // Avoid indefinite hangs when KafkaTemplate send never completes (e.g. metadata/acks issues).
            sendAsync(topic, key, payload)
                    .get(DEFAULT_SYNC_SEND_TIMEOUT_MS, TimeUnit.MILLISECONDS);
        } catch (CompletionException ce) {
            Throwable cause = ce.getCause();

            // Non-retryable (fail fast)
            if (cause instanceof RecordTooLargeException
                    || cause instanceof AuthorizationException
                    || cause instanceof SerializationException
                    || cause instanceof InvalidTopicException
                    || cause instanceof UnknownTopicOrPartitionException) {
                throw new NonRetryableKafkaException(
                        "fatal kafka error: topic=%s key=%s".formatted(topic, key), cause);
            }

            // Retryable (transient)
            throw new TransientKafkaSendException(
                    "transient kafka error: topic=%s key=%s".formatted(topic, key), cause);
        } catch (java.util.concurrent.TimeoutException te) {
            throw new TransientKafkaSendException(
                    "transient kafka timeout after %dms: topic=%s key=%s".formatted(DEFAULT_SYNC_SEND_TIMEOUT_MS, topic, key), te);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new TransientKafkaSendException(
                    "transient kafka send interrupted: topic=%s key=%s".formatted(topic, key), ie);
        } catch (java.util.concurrent.ExecutionException ee) {
            Throwable cause = ee.getCause();
            if (cause == null) cause = ee;

            if (cause instanceof RecordTooLargeException
                    || cause instanceof AuthorizationException
                    || cause instanceof SerializationException
                    || cause instanceof InvalidTopicException
                    || cause instanceof UnknownTopicOrPartitionException) {
                throw new NonRetryableKafkaException(
                        "fatal kafka error: topic=%s key=%s".formatted(topic, key), cause);
            }
            throw new TransientKafkaSendException(
                    "transient kafka error: topic=%s key=%s".formatted(topic, key), cause);
        }
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
