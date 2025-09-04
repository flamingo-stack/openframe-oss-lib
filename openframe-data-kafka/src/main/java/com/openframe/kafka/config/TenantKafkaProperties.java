package com.openframe.kafka.config;

import org.springframework.boot.autoconfigure.kafka.KafkaProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuration properties for tenant Kafka cluster using standard spring.kafka prefix.
 * Inherits all possible parameters from standard KafkaProperties.
 * This is the main/default Kafka cluster configuration.
 */
@ConfigurationProperties(prefix = "spring.kafka")
public class TenantKafkaProperties extends KafkaProperties {
    
    /**
     * Enable tenant Kafka cluster configuration.
     * Enabled by default.
     */
    private boolean enabled = true;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }
}
