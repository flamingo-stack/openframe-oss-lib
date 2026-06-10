package com.openframe.client.publisher;

import com.openframe.kafka.model.KafkaMessage;

import java.util.Map;

/**
 * Publishes a command-result event to Kafka.
 *
 * <p>The concrete Kafka cluster (and topic) is deployment-specific
 * <ul>
 *   <li>OSS deployment → {@link DefaultEventLogsPublisher} (oss-tenant Kafka)</li>
 *   <li>SaaS deployment → its own bean (shared Kafka)</li>
 * </ul>
 * The SaaS implementation lives in the saas-client service and, by being present,
 * suppresses the {@link DefaultEventLogsPublisher} via {@code @ConditionalOnMissingBean}.
 */
public interface EventLogsPublisher {

    /**
     * @param key     partition/routing key (machineId)
     * @param event   the command-result event payload
     * @param headers Kafka headers (must include {@code message-type})
     */
    void publish(String key, KafkaMessage event, Map<String, Object> headers);
}
