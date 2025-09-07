package com.openframe.kafka.config;

import org.springframework.boot.autoconfigure.kafka.KafkaProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuration properties for OSS Kafka cluster using spring.oss-kafka prefix.
 * Inherits all possible parameters from standard KafkaProperties.
 * This is the main/default Kafka cluster configuration.
 */
@ConfigurationProperties(prefix = "spring.oss-tenant")
public class OssTenantKafkaProperties {
    
    /**
     * Enable OSS Kafka cluster configuration.
     * Enabled by default.
     */
    private boolean enabled = true;

    private final KafkaProperties kafka = new KafkaProperties();

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public KafkaProperties getKafka() { return kafka; }
}
