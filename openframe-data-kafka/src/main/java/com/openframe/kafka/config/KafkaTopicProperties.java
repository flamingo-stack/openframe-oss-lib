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

    @Data
    public static class TopicConfig {
        private String name;
        private int partitions = 1;
        private short replicationFactor = 1;
    }
}
