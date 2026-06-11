package com.openframe.client.publisher;

import com.openframe.kafka.model.KafkaMessage;
import com.openframe.kafka.producer.retry.OssTenantRetryingKafkaProducer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Default (OSS) command-result publisher: publishes to the oss-tenant Kafka.
 *
 * <p>Used only when no other {@link EventLogsPublisher} bean is present
 * (e.g. the SaaS deployment provides its own, shared-Kafka implementation).
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnMissingBean(value = EventLogsPublisher.class, ignored = DefaultEventLogsPublisher.class)
public class DefaultEventLogsPublisher implements EventLogsPublisher {

    private final OssTenantRetryingKafkaProducer kafkaProducer;

    @Value("${openframe.oss-tenant.kafka.topics.outbound.logs-events}")
    private String topic;

    @Override
    public void publish(String key, KafkaMessage event, Map<String, Object> headers) {
        kafkaProducer.publish(topic, key, event, headers);
        log.debug("Published command result to oss-tenant Kafka: topic={} key={}", topic, key);
    }
}
