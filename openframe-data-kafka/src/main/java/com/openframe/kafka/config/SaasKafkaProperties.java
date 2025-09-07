package com.openframe.kafka.config;

import org.springframework.boot.autoconfigure.kafka.KafkaProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuration properties for shared Kafka cluster.
 * Inherits all possible parameters from standard KafkaProperties.
 * Activated only when spring.kafka.shared.bootstrap-servers is configured.
 */
@ConfigurationProperties(prefix = "spring.shared-cluster")
public class SaasKafkaProperties {
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
