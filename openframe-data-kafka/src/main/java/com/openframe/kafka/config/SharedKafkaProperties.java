package com.openframe.kafka.config;

import org.springframework.boot.autoconfigure.kafka.KafkaProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuration properties for shared Kafka cluster.
 * Inherits all possible parameters from standard KafkaProperties.
 * Activated only when spring.kafka.shared.bootstrap-servers is configured.
 */
@ConfigurationProperties(prefix = "spring.shared-kafka")
public class SharedKafkaProperties extends KafkaProperties {
}
