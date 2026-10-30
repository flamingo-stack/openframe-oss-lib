package com.openframe.kafka.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.kafka.autoconfigure.KafkaProperties;

/**
 * Configuration properties for OSS Kafka cluster using spring.oss-kafka prefix.
 * Inherits all possible parameters from standard KafkaProperties.
 * This is the main/default Kafka cluster configuration.
 */
@Getter
@ConfigurationProperties(prefix = "spring.oss-tenant")
public class OssTenantKafkaProperties {

    /**
     * Enable OSS Kafka cluster configuration.
     * Enabled by default.
     */
    @Setter
    private boolean enabled = true;

    private final KafkaProperties kafka = new KafkaProperties();

    @Setter
    private String dualWriteBootstrapServers;
}
