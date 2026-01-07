package com.openframe.kafka.config;

import java.util.ArrayList;
import java.util.List;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.KafkaAdmin;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@AutoConfiguration(after = OssTenantKafkaAutoConfiguration.class)
@EnableConfigurationProperties({KafkaTopicProperties.class, OssTenantKafkaProperties.class})
@ConditionalOnProperty(prefix = "openframe.oss-tenant.kafka.topics", name = "auto-create", havingValue = "true", matchIfMissing = true)
public class KafkaTopicAutoConfiguration {

    @Bean
    public KafkaAdmin.NewTopics kafkaTopics(KafkaTopicProperties properties) {
        List<NewTopic> topics = new ArrayList<>();

        properties.getInbound().forEach((key, config) -> {
            if (config.getName() != null && !config.getName().isBlank()) {
                NewTopic topic = TopicBuilder.name(config.getName())
                        .partitions(config.getPartitions())
                        .replicas(config.getReplicationFactor())
                        .build();
                topics.add(topic);
                log.info("Registered Kafka topic for auto-creation: {} (partitions={}, replicas={})",
                        config.getName(), config.getPartitions(), config.getReplicationFactor());
            }
        });

        return new KafkaAdmin.NewTopics(topics.toArray(new NewTopic[0]));
    }
}
