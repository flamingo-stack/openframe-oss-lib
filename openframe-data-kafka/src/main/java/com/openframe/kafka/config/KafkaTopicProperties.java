package com.openframe.kafka.config;

import java.util.HashMap;
import java.util.Map;

import org.springframework.boot.context.properties.ConfigurationProperties;

import lombok.Data;

@Data
@ConfigurationProperties(prefix = "openframe.oss-tenant.kafka.topics")
public class KafkaTopicProperties {

    private boolean autoCreate = true;

    private Map<String, TopicConfig> inbound = new HashMap<>();

    private RetryConfig retry = new RetryConfig();

    private int timeoutSeconds = 30;

    @Data
    public static class TopicConfig {
        private String name;
        private int partitions = 1;
        private short replicationFactor = 1;
    }

    @Data
    public static class RetryConfig {
        private int maxAttempts = 10;
        private long delayMs = 5000;
    }
}
